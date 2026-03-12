import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { downloadFile } from '@/lib/storage/upload'
import { extractTextFromPdf, truncateTextForAI } from '@/lib/extraction/pdf'
import { extractTextFromUrl } from '@/lib/extraction/url'
import { bufferToBase64DataUrl } from '@/lib/extraction/image'
import { callOpenRouter } from '@/lib/openrouter/client'
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT_TEMPLATE } from '@/lib/openrouter/prompts'
import { parseExtractionResponse, mapToLiteratureUpdate, mapToContentRows, mapToEvidenceRows } from '@/lib/extraction/parser'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { literatureId, promptId } = body

  if (!literatureId) {
    return NextResponse.json({ error: 'literatureId is required' }, { status: 400 })
  }

  // Fetch literature row (verify ownership)
  const { data: lit, error: litError } = await supabase
    .from('literature')
    .select('*')
    .eq('id', literatureId)
    .eq('user_id', user.id)
    .single()

  if (litError || !lit) {
    return NextResponse.json({ error: 'Literature not found' }, { status: 404 })
  }

  // Mark as processing
  await supabase
    .from('literature')
    .update({ extraction_status: 'processing' })
    .eq('id', literatureId)

  try {
    // Load prompt
    let systemPrompt = DEFAULT_SYSTEM_PROMPT
    let userPromptTemplate = DEFAULT_USER_PROMPT_TEMPLATE

    if (promptId) {
      const { data: prompt } = await supabase
        .from('ai_prompts')
        .select('*')
        .eq('id', promptId)
        .eq('user_id', user.id)
        .single()

      if (prompt) {
        systemPrompt = prompt.system_prompt
        userPromptTemplate = prompt.user_prompt_template
      }
    }

    // Extract text content
    let textContent = ''
    let messages: Array<{ role: string; content: unknown }> = []

    if (lit.source_type === 'pdf' && lit.storage_path) {
      const buffer = await downloadFile(lit.storage_path)
      const rawText = await extractTextFromPdf(buffer)
      textContent = truncateTextForAI(rawText)
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPromptTemplate.replace('{{CONTENT}}', textContent) },
      ]
    } else if (lit.source_type === 'url' && lit.source_url) {
      textContent = await extractTextFromUrl(lit.source_url)
      textContent = truncateTextForAI(textContent)
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPromptTemplate.replace('{{CONTENT}}', textContent) },
      ]
    } else if (lit.source_type === 'image' && lit.storage_path) {
      const buffer = await downloadFile(lit.storage_path)
      // Determine mime type from filename
      const filename = lit.original_filename || ''
      const mimeType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg'
      const dataUrl = bufferToBase64DataUrl(buffer, mimeType)
      messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            {
              type: 'text',
              text: userPromptTemplate.replace(
                '{{CONTENT}}',
                '[Image of academic paper - please extract all text and metadata from the image above]'
              ),
            },
          ],
        },
      ]
    } else {
      throw new Error('Cannot determine content source')
    }

    // Call OpenRouter
    let rawResponse = ''
    rawResponse = await callOpenRouter({
      model: 'anthropic/claude-3-haiku',
      messages: messages as Parameters<typeof callOpenRouter>[0]['messages'],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 8000,
    })

    // Parse and store results
    let extractionResult
    try {
      extractionResult = parseExtractionResponse(rawResponse)
    } catch {
      // Store raw response preview in ai_feedback for debugging
      const preview = rawResponse.slice(0, 300)
      throw new Error(`Invalid JSON response from AI. Preview: ${preview}`)
    }

    // Update literature with metadata
    const literatureUpdate = mapToLiteratureUpdate(extractionResult, literatureId)
    await supabase.from('literature').update(literatureUpdate).eq('id', literatureId)

    // Delete old content and insert new
    await supabase.from('literature_content').delete().eq('literature_id', literatureId)
    const contentRows = mapToContentRows(extractionResult, literatureId)
    if (contentRows.length > 0) {
      await supabase.from('literature_content').insert(contentRows)
    }

    // Delete old evidence and insert new
    await supabase.from('empirical_evidence').delete().eq('literature_id', literatureId)
    const evidenceRows = mapToEvidenceRows(extractionResult, literatureId)
    if (evidenceRows.length > 0) {
      await supabase.from('empirical_evidence').insert(evidenceRows)
    }

    // Fetch final state
    const { data: finalLit } = await supabase
      .from('literature')
      .select('*')
      .eq('id', literatureId)
      .single()

    const { data: content } = await supabase
      .from('literature_content')
      .select('*')
      .eq('literature_id', literatureId)
      .order('section_order')

    const { data: evidence } = await supabase
      .from('empirical_evidence')
      .select('*')
      .eq('literature_id', literatureId)
      .order('sort_order')

    // Update batch job progress
    const { data: batchLink } = await supabase
      .from('batch_literature')
      .select('batch_id')
      .eq('literature_id', literatureId)
      .single()

    if (batchLink) {
      const { data: batch } = await supabase
        .from('batch_jobs')
        .select('*')
        .eq('id', batchLink.batch_id)
        .single()

      if (batch) {
        const newCompleted = batch.completed_files + 1
        const isDone = newCompleted >= batch.total_files
        await supabase
          .from('batch_jobs')
          .update({
            completed_files: newCompleted,
            overall_status: isDone ? 'completed' : 'processing',
            completed_at: isDone ? new Date().toISOString() : null,
          })
          .eq('id', batch.id)
      }
    }

    return NextResponse.json({
      success: true,
      literature: {
        ...finalLit,
        content: content || [],
        evidence: evidence || [],
      },
    })
  } catch (error) {
    console.error('Extraction error:', error)

    // Mark as failed, store error in ai_feedback
    const errMsg = error instanceof Error ? error.message : 'Extraction failed'
    await supabase
      .from('literature')
      .update({ extraction_status: 'failed', ai_feedback: errMsg })
      .eq('id', literatureId)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Extraction failed' },
      { status: 500 }
    )
  }
}

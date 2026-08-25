/**
 * AI Service — Feature-flagged OpenAI integration
 *
 * All AI features in this file. When OPENAI_API_KEY is not set (or
 * aiEnabled = false in Settings), all functions return template-based fallbacks.
 *
 * AI 서비스: OPENAI_API_KEY 설정 시 AI 기능 활성화, 없으면 템플릿 기반 응답
 *
 * Usage:
 *   const draft = await generateQuoteReply({ ... });
 *   const reply = await generateInquiryReply({ ... });
 *   const contractNotes = await generateContractScope({ ... });
 *
 * Features:
 *   · AI-suggested reply to quote requests
 *   · AI-assisted contract scope/notes
 *   · AI draft for inquiry replies
 */

import { db } from '@/lib/db';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

// Lazy-load OpenAI so the app starts fine without the package installed
async function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    // Check DB setting
    const settings = await db.settings.findFirst();
    if (!settings?.aiEnabled) return null;

    const { default: OpenAI } = await import('openai');
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are a professional customer service representative for Ecowoods,
a premium hardwood flooring company in Toronto, Canada.
Tone: warm, knowledgeable, professional.
Always sign off as "The Ecowoods Team" and mention the phone number ${BUSINESS_NAP.phoneDisplay} if the customer may need to call.
Keep responses concise — 3-5 short paragraphs maximum.`;

// ─── Generate a suggested reply to a new quote request ───────────────────────
export async function generateQuoteReply({
  customerName,
  city,
  service,
  species,
  squareFeet,
  notes,
}: {
  customerName: string;
  city?: string;
  service?: string;
  species?: string[];
  squareFeet?: number;
  notes?: string;
}): Promise<string> {
  const openai = await getOpenAI();

  if (!openai) {
    // Template fallback
    return `Hi ${customerName},

Thank you for reaching out to Ecowoods! We'd love to help with your ${service ?? 'flooring'} project${city ? ` in ${city}` : ''}.

A senior estimator will be in touch within 1 business day to schedule a free, no-obligation in-home consultation. We'll bring species samples and finish options to help you visualize the result.

In the meantime, please don't hesitate to call us at ${BUSINESS_NAP.phoneDisplay} if you have any questions.

Warm regards,
The Ecowoods Team`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Draft a warm, professional reply to a new quote request from ${customerName}.
Details: Service: ${service ?? 'general inquiry'} · Location: ${city ?? 'GTA'} · Species interest: ${species?.join(', ') ?? 'not specified'} · Approx sq ft: ${squareFeet ?? 'not specified'}
Customer notes: "${notes ?? 'None'}"
Keep it under 150 words. Don't mention specific pricing.`,
      },
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content ?? 'Thank you for your inquiry. Our team will be in touch shortly.';
}

// ─── Generate a reply to a general inquiry ───────────────────────────────────
export async function generateInquiryReply({
  subject,
  customerName,
  message,
}: {
  subject: string;
  customerName: string;
  message?: string;
}): Promise<string> {
  const openai = await getOpenAI();

  if (!openai) {
    return `Hi ${customerName},

Thank you for your message regarding "${subject}".

Our team is reviewing your inquiry and will provide a detailed response shortly. If you need to speak with someone immediately, please call us at ${BUSINESS_NAP.phoneDisplay}.

Best regards,
The Ecowoods Team`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Draft a helpful reply to this customer inquiry.
Subject: "${subject}"
Customer name: ${customerName}
${message ? `Their message: "${message}"` : ''}
Keep it under 200 words. Be specific and helpful.`,
      },
    ],
    max_tokens: 400,
    temperature: 0.65,
  });

  return completion.choices[0]?.message?.content ?? `Hi ${customerName},

Thank you for your inquiry. We'll be in touch shortly.

The Ecowoods Team`;
}

// ─── Generate contract scope / description ───────────────────────────────────
export async function generateContractScope({
  title,
  service,
  species,
  squareFeet,
  city,
}: {
  title: string;
  service?: string;
  species?: string[];
  squareFeet?: number;
  city?: string;
}): Promise<string> {
  const openai = await getOpenAI();

  if (!openai) {
    return `Professional hardwood flooring services for ${title}.
${service ? `Service type: ${service}.` : ''}
${species?.length ? `Species: ${species.join(', ')}.` : ''}
${squareFeet ? `Approximate area: ${squareFeet.toLocaleString()} sq ft.` : ''}

All work performed by Ecowoods' salaried master craftsmen. Includes subfloor preparation, moisture testing, installation/finishing, and clean-up. Dust-free HEPA sanding where applicable.`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a professional flooring contractor writing a scope of work section for a client contract.' },
      {
        role: 'user',
        content: `Write a professional, concise scope of work (2-3 paragraphs) for this flooring project:
Title: ${title}
Location: ${city ?? 'Toronto, ON'}
Service: ${service ?? 'hardwood flooring'}
Species: ${species?.join(', ') ?? 'TBD'}
Area: ${squareFeet ? `${squareFeet.toLocaleString()} sq ft` : 'TBD'}
Include professional standards like moisture testing, acclimation, and warranty.`,
      },
    ],
    max_tokens: 400,
    temperature: 0.5,
  });

  return completion.choices[0]?.message?.content ?? `Scope of work for ${title}.`;
}

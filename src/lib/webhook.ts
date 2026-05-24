import type { UserProfile } from './supabase';

const BACKEND_WEBHOOK_URL = 'YOUR_N8N_WEBHOOK_URL_HERE';

export type WebhookPayload = {
  event_type: 'CLIENT_REQUEST_DELEGATION';
  timestamp: string;
  user_profile: {
    user_id: string;
    role: string;
    location: string;
    max_walk_time_mins: number;
    payment_range: { min: number; max: number };
    skills_interests: string[];
  };
  request_details: {
    raw_message: string;
    extracted_topic: string;
    gig_type: 'post' | 'search';
    category: string;
    title: string;
    content: string;
    pay_min: number;
    pay_max: number;
    campus_location: string;
    is_remote: boolean;
    gig_id: string;
  };
};

export type WebhookMatch = {
  id: string;
  matched_user_name: string;
  matched_user_id: string;
  match_score: number;
  title: string;
  category: string;
  pay_min: number;
  pay_max: number;
  campus_location: string;
  walk_time_mins: number;
  description: string;
};

export type WebhookResponse = {
  success: boolean;
  matches: WebhookMatch[];
  message?: string;
};

export async function sendWebhookRequest(
  payload: WebhookPayload,
  signal?: AbortSignal
): Promise<WebhookResponse> {
  if (BACKEND_WEBHOOK_URL === 'YOUR_N8N_WEBHOOK_URL_HERE') {
    // Return mock matches when webhook not configured
    await new Promise((r) => setTimeout(r, 2000));
    return generateMockMatches(payload);
  }

  const response = await fetch(BACKEND_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<WebhookResponse>;
}

export function buildWebhookPayload(
  profile: UserProfile,
  rawMessage: string,
  gigDetails: {
    gig_id: string;
    gig_type: 'post' | 'search';
    category: string;
    title: string;
    content: string;
    pay_min: number;
    pay_max: number;
    campus_location: string;
    is_remote: boolean;
    extracted_topic: string;
  }
): WebhookPayload {
  return {
    event_type: 'CLIENT_REQUEST_DELEGATION',
    timestamp: new Date().toISOString(),
    user_profile: {
      user_id: profile.user_id,
      role: profile.role,
      location: profile.campus_location,
      max_walk_time_mins: profile.max_walk_time_mins,
      payment_range: { min: profile.pay_min, max: profile.pay_max },
      skills_interests: profile.skills_interests,
    },
    request_details: {
      raw_message: rawMessage,
      extracted_topic: gigDetails.extracted_topic,
      gig_type: gigDetails.gig_type,
      category: gigDetails.category,
      title: gigDetails.title,
      content: gigDetails.content,
      pay_min: gigDetails.pay_min,
      pay_max: gigDetails.pay_max,
      campus_location: gigDetails.campus_location,
      is_remote: gigDetails.is_remote,
      gig_id: gigDetails.gig_id,
    },
  };
}

function generateMockMatches(payload: WebhookPayload): WebhookResponse {
  const locations = ['East Hall', 'North Campus', 'Student Union', 'Library', 'Engineering Quad'];
  const names = ['Alex Chen', 'Jordan Smith', 'Maya Patel', 'Liam Torres', 'Priya Rao'];

  const count = Math.floor(Math.random() * 3) + 2;
  const matches: WebhookMatch[] = [];

  for (let i = 0; i < count; i++) {
    const score = Math.floor(Math.random() * 20) + (80 - i * 8);
    matches.push({
      id: crypto.randomUUID(),
      matched_user_name: names[i % names.length],
      matched_user_id: crypto.randomUUID(),
      match_score: Math.min(score, 99),
      title: payload.request_details.title || 'Campus Gig',
      category: payload.request_details.category,
      pay_min: payload.request_details.pay_min,
      pay_max: payload.request_details.pay_max,
      campus_location: locations[i % locations.length],
      walk_time_mins: Math.floor(Math.random() * 15) + 3,
      description: `Experienced with ${payload.request_details.category.toLowerCase()}. Available immediately.`,
    });
  }

  matches.sort((a, b) => b.match_score - a.match_score);
  return { success: true, matches };
}

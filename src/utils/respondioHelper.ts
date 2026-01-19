/**
 * Respond.io WhatsApp Business API Helper
 * 
 * This helper function sends WhatsApp template messages via Respond.io API.
 * Respond.io acts as a messaging layer for WhatsApp Business API.
 * 
 * Documentation: https://docs.respond.io/
 */

export interface RespondIOTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters?: Array<{
    type: 'text' | 'currency' | 'date_time';
    text?: string;
    currency?: {
      fallback_value: string;
      code: string;
      amount_1000: number;
    };
    date_time?: {
      fallback_value: string;
    };
  }>;
}

export interface SendRespondIOTemplateParams {
  phone: string; // E.164 format (e.g., +260971234567)
  templateName: string; // Template name approved in WhatsApp Business Manager
  languageCode?: string; // ISO 639-1 language code (default: 'en')
  components?: RespondIOTemplateComponent[];
}

export interface RespondIOConfig {
  apiKey: string;
  baseUrl?: string; // Default: https://api.respond.io/v3
  channelId: string; // WhatsApp channel ID from Respond.io
}

/**
 * Sends a WhatsApp template message via Respond.io API
 * 
 * @param params - Template message parameters
 * @param config - Respond.io API configuration
 * @returns Promise with API response
 * 
 * @example
 * ```typescript
 * const result = await sendRespondIOTemplate(
 *   {
 *     phone: '+260971234567',
 *     templateName: 'loan_due_soon',
 *     languageCode: 'en',
 *     components: [
 *       {
 *         type: 'body',
 *         parameters: [
 *           { type: 'text', text: 'John Doe' },
 *           { type: 'text', text: 'K5,000' },
 *           { type: 'text', text: '2026-01-20' }
 *         ]
 *       }
 *     ]
 *   },
 *   {
 *     apiKey: 'your-api-key',
 *     channelId: 'your-channel-id'
 *   }
 * );
 * ```
 */
export async function sendRespondIOTemplate(
  params: SendRespondIOTemplateParams,
  config: RespondIOConfig
): Promise<any> {
  const { phone, templateName, languageCode = 'en', components = [] } = params;
  const { apiKey, baseUrl = 'https://api.respond.io/v3', channelId } = config;

  // Validate required parameters
  if (!phone || !templateName || !apiKey || !channelId) {
    throw new Error('Missing required parameters: phone, templateName, apiKey, or channelId');
  }

  // Format phone number to E.164 format if needed
  let formattedPhone = phone.trim();
  if (!formattedPhone.startsWith('+')) {
    // Assume Zambia country code if not provided
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+260' + formattedPhone.substring(1);
    } else {
      formattedPhone = '+260' + formattedPhone;
    }
  }

  // Remove any spaces or special characters except +
  formattedPhone = formattedPhone.replace(/[^\d+]/g, '');

  // Build the request payload
  const payload: any = {
    channelId: channelId,
    to: formattedPhone,
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
    },
  };

  // Add components if provided
  if (components.length > 0) {
    payload.template.components = components;
  }

  // Make the API request
  const url = `${baseUrl}/messages`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let result: any;

    try {
      result = JSON.parse(responseText);
    } catch (e) {
      // If response is not JSON, create error object
      result = { error: responseText, status: response.status };
    }

    // Log the response for debugging
    console.log('[Respond.io] API Response:', {
      status: response.status,
      statusText: response.statusText,
      body: result,
    });

    // Check if request was successful
    if (!response.ok) {
      const errorMessage = result?.message || result?.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`Respond.io API error: ${errorMessage}`);
    }

    return result;
  } catch (error: any) {
    // Handle network errors or API errors
    if (error.message?.includes('Respond.io API error')) {
      throw error;
    }
    throw new Error(`Failed to send WhatsApp message via Respond.io: ${error.message}`);
  }
}

/**
 * Helper function to create text parameters for template components
 */
export function createTextParameter(text: string): { type: 'text'; text: string } {
  return { type: 'text', text };
}

/**
 * Helper function to create currency parameters for template components
 */
export function createCurrencyParameter(
  amount: number,
  currencyCode: string = 'ZMW'
): { type: 'currency'; currency: { fallback_value: string; code: string; amount_1000: number } } {
  return {
    type: 'currency',
    currency: {
      fallback_value: `${currencyCode} ${amount.toFixed(2)}`,
      code: currencyCode,
      amount_1000: Math.round(amount * 1000), // Convert to smallest currency unit
    },
  };
}

/**
 * Helper function to create date/time parameters for template components
 */
export function createDateTimeParameter(date: Date | string): {
  type: 'date_time';
  date_time: { fallback_value: string };
} {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const formattedDate = dateObj.toISOString();
  
  return {
    type: 'date_time',
    date_time: {
      fallback_value: formattedDate,
    },
  };
}

/**
 * Helper function to format date for WhatsApp template (readable format)
 */
export function formatDateForTemplate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-ZM', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Helper function to format currency for WhatsApp template (readable format)
 */
export function formatCurrencyForTemplate(amount: number, currencyCode: string = 'ZMW'): string {
  return `K${amount.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

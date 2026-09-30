import crypto from 'node:crypto';

/**
 * Exotel Service Module.
 * Isolates all Exotel API configuration, outbound call dispatch, webhook signature validation,
 * and AgentStream WebSocket status resolution.
 * Credentials are strictly read from environment variables and never logged or exposed to the client.
 */
export class ExotelService {
  constructor() {
    this.accountSid = (process.env.EXOTEL_ACCOUNT_SID || '').trim();
    this.apiKey = (process.env.EXOTEL_API_KEY || '').trim();
    this.apiToken = (process.env.EXOTEL_API_TOKEN || '').trim();
    this.virtualNumber = (process.env.EXOTEL_VIRTUAL_NUMBER || process.env.EXOTEL_PHONE_NUMBER || '').trim();
    this.subdomain = (process.env.EXOTEL_SUBDOMAIN || process.env.EXOTEL_REGION || 'api.exotel.com').trim();
    this.webhookSecret = (process.env.EXOTEL_WEBHOOK_SECRET || '').trim();
    this.publicHost = (process.env.PUBLIC_HOST || '').trim();
    this.publicBaseUrl = (process.env.PUBLIC_BASE_URL || 'http://localhost:5055').trim();
    this.audioCodec = (process.env.EXOTEL_AUDIO_CODEC || 'audio/l16').trim();
    this.sampleRate = parseInt(process.env.EXOTEL_SAMPLE_RATE || '8000', 10);
  }

  /**
   * Checks whether Exotel API credentials are fully configured
   */
  isConfigured() {
    return Boolean(
      this.accountSid &&
      this.apiKey &&
      this.apiToken &&
      !this.accountSid.includes('your_') &&
      !this.apiKey.includes('your_') &&
      !this.apiToken.includes('your_')
    );
  }

  /**
   * Checks whether an Exotel virtual helpline number is configured
   */
  isVirtualNumberConfigured() {
    return Boolean(
      this.virtualNumber &&
      !this.virtualNumber.includes('your_') &&
      this.virtualNumber.length >= 8
    );
  }

  /**
   * Validates configuration and returns missing required parameters (if any)
   */
  validateConfig() {
    const missing = [];
    if (!this.accountSid || this.accountSid.includes('your_')) missing.push('EXOTEL_ACCOUNT_SID');
    if (!this.apiKey || this.apiKey.includes('your_')) missing.push('EXOTEL_API_KEY');
    if (!this.apiToken || this.apiToken.includes('your_')) missing.push('EXOTEL_API_TOKEN');
    if (!this.virtualNumber || this.virtualNumber.includes('your_')) missing.push('EXOTEL_VIRTUAL_NUMBER');

    return {
      valid: missing.length === 0,
      missing,
      configured: this.isConfigured(),
      virtualNumberConfigured: this.isVirtualNumberConfigured()
    };
  }

  /**
   * Safe status object suitable for public status endpoints and client consumption.
   * Redacts sensitive tokens and keys.
   */
  getStatus() {
    const isConfig = this.isConfigured();
    const isNumConfig = this.isVirtualNumberConfigured();

    // Compute public WebSocket URL according to configuration
    const host = (process.env.PUBLIC_HOST || this.publicHost || '').trim();
    let wssUrl;
    if (host) {
      const cleanHost = host.replace(/^(https?|wss?):\/\//i, '').replace(/\/+$/, '');
      wssUrl = `wss://${cleanHost}/api/voice/exotel/stream`;
    } else if (this.publicBaseUrl && this.publicBaseUrl.startsWith('http') && !this.publicBaseUrl.includes('localhost')) {
      wssUrl = this.publicBaseUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:').replace(/\/+$/, '') + '/api/voice/exotel/stream';
    } else {
      wssUrl = 'wss://<PUBLIC_HOST>/api/voice/exotel/stream';
    }

    // Mask account SID safely (e.g. "exo_...4a9t")
    let maskedSid = 'Not Configured';
    if (this.accountSid && !this.accountSid.includes('your_')) {
      maskedSid = this.accountSid.length > 8 
        ? `${this.accountSid.slice(0, 4)}...${this.accountSid.slice(-4)}` 
        : 'Configured';
    }

    // Mask phone number safely (e.g. "+91****5477")
    let maskedPhone = 'Not Configured';
    if (this.virtualNumber && !this.virtualNumber.includes('your_')) {
      maskedPhone = this.virtualNumber.length > 6
        ? `${this.virtualNumber.slice(0, 3)}****${this.virtualNumber.slice(-4)}`
        : this.virtualNumber;
    }

    return {
      configured: isConfig,
      virtualNumberConfigured: isNumConfig,
      accountSid: maskedSid,
      virtualNumber: maskedPhone,
      subdomain: this.subdomain,
      codec: this.audioCodec,
      sampleRate: this.sampleRate,
      streamEndpoint: '/api/voice/exotel/stream',
      publicHost: host || '<PUBLIC_HOST>',
      publicWssUrl: wssUrl,
      tunnelWarning: 'Exotel Voicebot requires a public HTTPS/WSS URL (e.g. ngrok or cloud domain) to reach this server. Set PUBLIC_HOST in .env or configure Exotel Stream applet with the publicWssUrl.'
    };
  }

  /**
   * Verify inbound webhook HMAC SHA256 signature from Exotel
   */
  verifyWebhookSignature(req) {
    if (!this.webhookSecret || this.webhookSecret.includes('your_')) {
      // Allow during development if secret is default placeholder
      return true;
    }

    const signature = req.headers['x-exotel-signature'] || req.headers['x-hub-signature'];
    if (!signature) return false;

    try {
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      const digest = hmac.update(JSON.stringify(req.body)).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
    } catch (err) {
      console.warn('[ExotelService] Signature verification failed:', err.message);
      return false;
    }
  }

  /**
   * Outbound call creation via Exotel REST API.
   * Isolated from inbound stream flow; does not change or interfere with the inbound WebSocket handler.
   */
  async makeOutboundCall({ from, to, flowId, customData = {} }) {
    if (!this.isConfigured()) {
      throw new Error('Exotel credentials are not configured. Check EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, and EXOTEL_API_TOKEN in .env');
    }

    const callerId = from || this.virtualNumber;
    if (!callerId) {
      throw new Error('Missing virtual number. Configure EXOTEL_VIRTUAL_NUMBER in .env or provide from parameter');
    }

    const apiUrl = `https://${this.subdomain}/v1/Accounts/${this.accountSid}/Calls/connect.json`;
    const authHeader = `Basic ${Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64')}`;

    const params = new URLSearchParams();
    params.append('From', to);
    params.append('CallerId', callerId);
    if (flowId) {
      params.append('Url', `http://my.exotel.com/${this.accountSid}/exoml/start_voice/${flowId}`);
    }
    if (customData && Object.keys(customData).length > 0) {
      params.append('CustomField', JSON.stringify(customData));
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Exotel API returned HTTP ${response.status}: ${errorText.slice(0, 150)}`);
      }

      const result = await response.json();
      return {
        success: true,
        callSid: result.Call?.Sid || result.CallSid || 'exo_out_' + Date.now(),
        status: result.Call?.Status || 'initiated'
      };
    } catch (err) {
      console.error('[ExotelService] Outbound call dispatch failed:', err.message);
      throw err;
    }
  }
}

export const exotelService = new ExotelService();

import { requestService } from './requestService.js';
import { callService } from './callService.js';
import { eventBus } from '../websocket/eventBus.js';

export class EmergencyService {
  async createFromCall(session, validatedData) {
    // 1. Create the emergency request
    const payload = {
      ...validatedData,
      source: 'AI VOICE',
      caller_phone: session.callerPhone,
      caller_language: session.language,
      created_from_call_id: session.id
    };

    const emergencyRequest = requestService.createRequest(payload);

    // 2. Persist call session record with the generated request ID
    session.requestId = emergencyRequest.request_id;
    session.status = 'COMPLETED';
    session.endedAt = new Date().toISOString();
    session.aiSummary = `Recorded emergency request ${emergencyRequest.request_id} for ${emergencyRequest.emergency_category} in ${emergencyRequest.location}. Affected people: ${emergencyRequest.affected_people_count}.`;

    callService.saveCallSession(session);

    // 3. Emit notification event
    eventBus.broadcast('CALL_COMPLETED', {
      callId: session.id,
      callSid: session.callSid,
      requestId: emergencyRequest.request_id,
      category: emergencyRequest.emergency_category,
      location: emergencyRequest.location
    });

    return emergencyRequest;
  }
}

export const emergencyService = new EmergencyService();

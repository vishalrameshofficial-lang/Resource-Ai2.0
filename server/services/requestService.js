import { getDatabase } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { validateEmergencyRequest, VALID_STATUSES } from '../ai/schemas.js';
import { eventBus } from '../websocket/eventBus.js';

export class RequestService {
  getAllRequests(filters = {}) {
    const db = getDatabase();
    let query = `
      SELECT * FROM emergency_requests 
      WHERE (id NOT LIKE 'req-sample-%' 
             AND request_id NOT LIKE 'REQ-2026-890%' 
             AND caller_phone NOT IN ('+919876543210', '+919944332211', '+919988776655'))
    `;
    const params = [];

    if (filters.status && filters.status !== 'ALL') {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.urgency && filters.urgency !== 'ALL') {
      query += ' AND urgency = ?';
      params.push(filters.urgency);
    }
    if (filters.category && filters.category !== 'ALL') {
      query += ' AND emergency_category = ?';
      params.push(filters.category);
    }
    if (filters.source && filters.source !== 'ALL') {
      query += ' AND source = ?';
      params.push(filters.source);
    }
    if (filters.search) {
      query += ' AND (request_id LIKE ? OR caller_name LIKE ? OR location LIKE ? OR description LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(r => ({
      ...r,
      resources_needed: JSON.parse(r.resources_needed || '[]'),
      immediate_danger: Boolean(r.immediate_danger)
    }));
  }

  getRequestById(idOrReqId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM emergency_requests 
      WHERE id = ? OR request_id = ?
    `);
    const req = stmt.get(idOrReqId, idOrReqId);
    if (!req) return null;

    // Fetch timeline
    const timelineStmt = db.prepare(`
      SELECT * FROM dispatch_timeline 
      WHERE request_id = ? 
      ORDER BY created_at ASC
    `);
    const timeline = timelineStmt.all(req.request_id);

    // Fetch call session if created from call
    let callSession = null;
    if (req.created_from_call_id) {
      const callStmt = db.prepare('SELECT * FROM call_sessions WHERE id = ? OR call_sid = ?');
      callSession = callStmt.get(req.created_from_call_id, req.created_from_call_id);
      if (callSession && callSession.transcript) {
        try {
          callSession.transcript = JSON.parse(callSession.transcript);
        } catch {
          // keep as string
        }
      }
    }

    return {
      ...req,
      resources_needed: JSON.parse(req.resources_needed || '[]'),
      immediate_danger: Boolean(req.immediate_danger),
      timeline,
      callSession
    };
  }

  createRequest(data) {
    const validation = validateEmergencyRequest(data);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const db = getDatabase();
    const normalized = validation.data;
    const now = new Date().toISOString();
    const id = `req-${uuidv4()}`;
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const requestId = `REQ-2026-${randNum}`;

    const insertStmt = db.prepare(`
      INSERT INTO emergency_requests (
        id, created_at, updated_at, request_id, caller_name, caller_phone,
        caller_language, emergency_category, description, location, landmark,
        latitude, longitude, affected_people_count, resources_needed, urgency,
        immediate_danger, source, status, admin_notes, government_reference, created_from_call_id
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `);

    insertStmt.run(
      id,
      now,
      now,
      requestId,
      normalized.caller_name,
      normalized.caller_phone,
      normalized.caller_language,
      normalized.emergency_category,
      normalized.description,
      normalized.location,
      normalized.landmark,
      normalized.latitude,
      normalized.longitude,
      normalized.affected_people_count,
      normalized.resources_needed,
      normalized.urgency,
      normalized.immediate_danger,
      normalized.source || 'WEB',
      'NEW',
      null,
      null,
      data.created_from_call_id || null
    );

    // Initial timeline record
    const timelineStmt = db.prepare(`
      INSERT INTO dispatch_timeline (id, request_id, status, title, description, actor, government_reference, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    timelineStmt.run(
      `time-${uuidv4().substring(0, 8)}`,
      requestId,
      'NEW',
      `Emergency Request Created (${normalized.source || 'WEB'})`,
      `Request registered in ResourceAI system for ${normalized.emergency_category} in ${normalized.location}.`,
      normalized.source === 'AI VOICE' ? 'AI VOICE' : 'CITIZEN',
      null,
      now
    );

    const createdRecord = this.getRequestById(id);

    // Broadcast real-time event to all connected dashboards
    eventBus.broadcast('NEW_REQUEST', createdRecord);

    return createdRecord;
  }

  updateRequestStatus(id, newStatus, adminNotes = null, governmentRef = null, actor = 'ADMIN') {
    if (!VALID_STATUSES.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const current = this.getRequestById(id);
    if (!current) {
      throw new Error(`Request not found: ${id}`);
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    const updateStmt = db.prepare(`
      UPDATE emergency_requests
      SET status = ?,
          admin_notes = COALESCE(?, admin_notes),
          government_reference = COALESCE(?, government_reference),
          updated_at = ?
      WHERE id = ? OR request_id = ?
    `);

    updateStmt.run(
      newStatus,
      adminNotes,
      governmentRef,
      now,
      id,
      id
    );

    // Timeline event title & description
    const statusTitles = {
      VERIFIED: 'Request Verified by Operations Admin',
      FORWARDED_TO_GOVERNMENT: 'Forwarded to Government Emergency Command',
      ACCEPTED: 'Accepted by Government Agency / Responders',
      RESOURCE_ALLOCATED: 'Relief Resources Allocated for Dispatch',
      DELIVERY_IN_PROGRESS: 'Relief Convoy / Team In Transit',
      DELIVERED: 'Relief Delivered / Situation Resolved',
      REJECTED: 'Request Marked as Duplicate or Invalid',
      CANCELLED: 'Request Cancelled by Requester'
    };

    const timelineStmt = db.prepare(`
      INSERT INTO dispatch_timeline (id, request_id, status, title, description, actor, government_reference, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    timelineStmt.run(
      `time-${uuidv4().substring(0, 8)}`,
      current.request_id,
      newStatus,
      statusTitles[newStatus] || `Status updated to ${newStatus}`,
      adminNotes || `Request transitioned to ${newStatus}. Ref: ${governmentRef || current.government_reference || 'N/A'}`,
      actor,
      governmentRef || current.government_reference || null,
      now
    );

    const updated = this.getRequestById(id);
    eventBus.broadcast('REQUEST_UPDATED', updated);
    return updated;
  }

  updateRequest(id, fields) {
    const current = this.getRequestById(id);
    if (!current) throw new Error(`Request not found: ${id}`);

    const db = getDatabase();
    const now = new Date().toISOString();

    const allowed = [
      'caller_name', 'caller_phone', 'caller_language', 'emergency_category',
      'description', 'location', 'landmark', 'latitude', 'longitude',
      'affected_people_count', 'urgency', 'immediate_danger', 'admin_notes', 'government_reference'
    ];

    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }

    if (fields.resources_needed) {
      updates.push('resources_needed = ?');
      values.push(JSON.stringify(fields.resources_needed));
    }

    if (updates.length === 0) return current;

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);
    values.push(id);

    const sql = `UPDATE emergency_requests SET ${updates.join(', ')} WHERE id = ? OR request_id = ?`;
    db.prepare(sql).run(...values);

    const updated = this.getRequestById(id);
    eventBus.broadcast('REQUEST_UPDATED', updated);
    return updated;
  }

  getStats() {
    const db = getDatabase();
    const REAL_FILTER = "WHERE id NOT LIKE 'req-sample-%' AND request_id NOT LIKE 'REQ-2026-890%' AND caller_phone NOT IN ('+919876543210', '+919944332211', '+919988776655')";

    const total = db.prepare(`SELECT COUNT(*) as count FROM emergency_requests ${REAL_FILTER}`).get()?.count || 0;
    const newReqs = db.prepare(`SELECT COUNT(*) as count FROM emergency_requests ${REAL_FILTER} AND status = 'NEW'`).get()?.count || 0;
    const highUrgency = db.prepare(`SELECT COUNT(*) as count FROM emergency_requests ${REAL_FILTER} AND urgency IN ('HIGH', 'CRITICAL')`).get()?.count || 0;
    const activeEmergencies = db.prepare(`SELECT COUNT(*) as count FROM emergency_requests ${REAL_FILTER} AND status NOT IN ('DELIVERED', 'REJECTED', 'CANCELLED')`).get()?.count || 0;
    const govtPending = db.prepare(`SELECT COUNT(*) as count FROM emergency_requests ${REAL_FILTER} AND status IN ('VERIFIED', 'FORWARDED_TO_GOVERNMENT')`).get()?.count || 0;
    const delivered = db.prepare(`SELECT COUNT(*) as count FROM emergency_requests ${REAL_FILTER} AND status = 'DELIVERED'`).get()?.count || 0;

    // Requests by category
    const byCategory = db.prepare(`
      SELECT emergency_category as name, COUNT(*) as count 
      FROM emergency_requests 
      ${REAL_FILTER}
      GROUP BY emergency_category
    `).all();

    // Requests by language
    const byLanguage = db.prepare(`
      SELECT caller_language as name, COUNT(*) as count 
      FROM emergency_requests 
      ${REAL_FILTER}
      GROUP BY caller_language
    `).all();

    // Requests by status
    const byStatus = db.prepare(`
      SELECT status as name, COUNT(*) as count 
      FROM emergency_requests 
      ${REAL_FILTER}
      GROUP BY status
    `).all();

    // Requests by urgency
    const byUrgency = db.prepare(`
      SELECT urgency as name, COUNT(*) as count 
      FROM emergency_requests 
      ${REAL_FILTER}
      GROUP BY urgency
    `).all();

    // Total affected people
    const peopleSum = db.prepare(`SELECT SUM(affected_people_count) as total FROM emergency_requests ${REAL_FILTER}`).get()?.total || 0;

    return {
      total,
      newRequests: newReqs,
      highUrgency,
      activeEmergencies,
      governmentPending: govtPending,
      delivered,
      totalAffectedPeople: peopleSum,
      byCategory,
      byLanguage,
      byStatus,
      byUrgency
    };
  }
}

export const requestService = new RequestService();

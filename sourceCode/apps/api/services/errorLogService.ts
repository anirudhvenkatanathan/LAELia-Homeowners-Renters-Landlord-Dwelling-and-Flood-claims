import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// ─── Schema ───────────────────────────────────────────────────────────────────

export interface IErrorLog extends Document {
  errorId: string;
  message: string;
  stack: string;
  context: string;
  timestamp: Date;
}

const ErrorLogSchema = new Schema<IErrorLog>({
  errorId:   { type: String, required: true },
  message:   { type: String, default: '' },
  stack:     { type: String, default: '' },
  context:   { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
});

const ErrorLogModel =
  mongoose.models['triage_errorlog'] as mongoose.Model<IErrorLog> ||
  mongoose.model<IErrorLog>('triage_errorlog', ErrorLogSchema);

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Logs an error to the MongoDB triage_errorlog collection.
 * Never throws — error logging must not cascade failures.
 */
export async function logError(
  error: Error | unknown,
  context: string
): Promise<void> {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const doc = new ErrorLogModel({
      errorId:   uuidv4(),
      message:   err.message,
      stack:     err.stack ?? '',
      context,
      timestamp: new Date(),
    });
    await doc.save();
  } catch {
    // Suppress cascading failures — print to console as last resort
    console.error('[errorLogService] Failed to write to triage_errorlog:', error);
  }
}

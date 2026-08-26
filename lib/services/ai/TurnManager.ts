export type TurnState = 
  | 'idle'
  | 'listening'
  | 'user_speaking'
  | 'transcribing'
  | 'processing'
  | 'ai_speaking';

export interface TurnLatencyRecord {
  turnId: number;
  sessionId: string;
  voiceStart?: number;
  sttComplete?: number;
  toolStart?: number;
  toolComplete?: number;
  aiStart?: number;
  aiComplete?: number;
  ttsStart?: number;
  ttsComplete?: number;
  totalDurationMs?: number;
}

export class TurnManager {
  private state: TurnState = 'idle';
  private currentSessionId: string;
  private currentTurnId: number = 0;
  private activeRequestLock: boolean = false;
  private latencyRecord: TurnLatencyRecord | null = null;
  private onStateChange?: (state: TurnState) => void;

  constructor(sessionId?: string, onStateChange?: (state: TurnState) => void) {
    this.currentSessionId = sessionId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}`);
    this.onStateChange = onStateChange;
  }

  public getState(): TurnState {
    return this.state;
  }

  public setState(nextState: TurnState) {
    this.state = nextState;
    if (this.onStateChange) {
      this.onStateChange(nextState);
    }
  }

  public startTurn(): { turnId: number; sessionId: string } | null {
    if (this.activeRequestLock) {
      console.warn(`[TurnManager] Turn already active, skipping duplicate turn creation.`);
      return null;
    }

    this.activeRequestLock = true;
    this.currentTurnId += 1;
    this.latencyRecord = {
      turnId: this.currentTurnId,
      sessionId: this.currentSessionId,
      voiceStart: Date.now(),
    };

    this.setState('processing');
    return { turnId: this.currentTurnId, sessionId: this.currentSessionId };
  }

  public logCheckpoint(event: 'sttComplete' | 'toolStart' | 'toolComplete' | 'aiStart' | 'aiComplete' | 'ttsStart' | 'ttsComplete') {
    if (!this.latencyRecord) return;
    const now = Date.now();
    this.latencyRecord[event] = now;

    if (event === 'ttsComplete' && this.latencyRecord.voiceStart) {
      this.latencyRecord.totalDurationMs = now - this.latencyRecord.voiceStart;
      console.log(`[TurnManager Performance Turn #${this.latencyRecord.turnId}]:`, {
        sttLatency: this.latencyRecord.sttComplete && this.latencyRecord.voiceStart ? `${this.latencyRecord.sttComplete - this.latencyRecord.voiceStart}ms` : 'N/A',
        aiLatency: this.latencyRecord.aiComplete && this.latencyRecord.aiStart ? `${this.latencyRecord.aiComplete - this.latencyRecord.aiStart}ms` : 'N/A',
        ttsLatency: this.latencyRecord.ttsComplete && this.latencyRecord.ttsStart ? `${this.latencyRecord.ttsComplete - this.latencyRecord.ttsStart}ms` : 'N/A',
        totalTurnaround: `${this.latencyRecord.totalDurationMs}ms`,
      });
    }
  }

  public completeTurn() {
    this.activeRequestLock = false;
    this.setState('idle');
  }

  public getSessionId(): string {
    return this.currentSessionId;
  }

  public getTurnId(): number {
    return this.currentTurnId;
  }
}

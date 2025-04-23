/**
 * Manages the scheduling of interval-based actions.
 */
export class IntervalScheduler {
    private intervalMinutes: number;
    private timer: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private onIntervalEndCallback: (() => void) | null = null;

    /**
     * Creates an instance of IntervalScheduler.
     * @param intervalMinutes The desired interval duration in minutes. Must be positive.
     * @param onIntervalEnd The callback function to execute when an interval ends.
     */
    constructor(intervalMinutes: number, onIntervalEnd: () => void) {
        // Ensure initial value is assigned
        this.intervalMinutes = intervalMinutes > 0 ? intervalMinutes : 15; // Default to 15 if invalid
        this.onIntervalEndCallback = onIntervalEnd;
        if (intervalMinutes <= 0) {
            console.warn(`[Scheduler] Initialized with invalid interval: ${intervalMinutes}. Defaulting to 15.`);
        }
    }

    /**
     * Starts the scheduling timer. If already running, does nothing.
     * Schedules the first action based on the current time and interval.
     */
    public start(): void {
        if (this.isRunning) {
            console.log("[Scheduler] Already running.");
            return;
        }
        console.log(`[Scheduler] Starting with interval ${this.intervalMinutes} minutes.`);
        this.isRunning = true;
        this.scheduleNextAction();
    }

    /**
     * Pauses the scheduling timer. If already paused, does nothing.
     * Clears any pending timeout.
     */
    public pause(): void {
        if (!this.isRunning) {
            return;
        }
        console.log("[Scheduler] Pausing.");
        this.isRunning = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
            console.log("[Scheduler] Timer cleared.");
        }
    }

    /**
     * Changes the interval duration.
     * If the scheduler is running, it clears the current timer and reschedules
     * the next action based on the *new* interval.
     * @param intervalMinutes The new interval duration in minutes. Must be positive.
     */
    public setInterval(intervalMinutes: number): void {
        if (intervalMinutes <= 0) {
            console.error(`[Scheduler] Invalid interval provided: ${intervalMinutes}. Interval not changed.`);
            return;
        }
        if(intervalMinutes === this.intervalMinutes){
            return; // No change needed
        }

        console.log(`[Scheduler] Setting interval to ${intervalMinutes} minutes.`);
        const needsReschedule = this.isRunning;
        this.intervalMinutes = intervalMinutes;

        if (needsReschedule) {
            console.log("[Scheduler] Rescheduling timer due to interval change.");
            // Clear existing timer before scheduling new one
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
            this.scheduleNextAction();
        }
    }

    private calculateNextIntervalEnd(now: number): number {
        // This check should ideally not be needed due to constructor/setInterval validation
        // but added for extra safety.
        if (this.intervalMinutes <= 0) {
             console.error("[Scheduler] Cannot calculate next interval with non-positive duration.");
             return now + 24 * 60 * 60 * 1000; // Far future
        }
        const intervalMillis = this.intervalMinutes * 60 * 1000;
        // Calculate the end of the current interval block
        const nextIntervalStart = Math.ceil(now / intervalMillis) * intervalMillis;
        // Ensure the next interval is strictly after the current time, 
        // otherwise ceil might return the *start* of the current interval block if now is exactly on the boundary.
        // Add a small epsilon (1ms) before ceiling if needed, or adjust logic.
        // Simpler approach: if result <= now, add intervalMillis.
        if (nextIntervalStart <= now) {
             return nextIntervalStart + intervalMillis;
        } 
        return nextIntervalStart;
    }

    private scheduleNextAction(): void {
        if (!this.isRunning) {
            return; // Don't schedule if paused
        }

        // Clear any potentially existing timer first
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        const now = Date.now();
        const nextIntervalEndTime = this.calculateNextIntervalEnd(now);
        let delay = nextIntervalEndTime - now;

        // Handle potential negative delay or zero delay
        if (delay <= 0) {
            console.warn(`[Scheduler] Calculated delay is non-positive (${delay}ms). Scheduling for immediate run (with 50ms safety delay).`);
            delay = 50; // Use a small positive delay 
        }

        console.log(`[Scheduler] Scheduling next action in ${delay} ms (at ${new Date(nextIntervalEndTime).toISOString()})`);

        this.timer = setTimeout(() => {
            this.timer = null; // Clear reference before executing callback
            this.performActions();
        }, delay);
        this.timer.unref(); 
    }

    private performActions(): void {
        // Double-check if running, in case pause() was called just before timeout fired
        if (!this.isRunning) {
            console.warn("[Scheduler] performActions called while not running (likely paused just before timeout). Skipping.");
            return;
        }

        console.log(`[Scheduler] Performing scheduled actions at ${new Date().toISOString()}`);
        try {
            this.onIntervalEndCallback?.();
        } catch (error) {
            console.error("[Scheduler] Error executing onIntervalEnd callback:", error);
        }

        // IMPORTANT: Schedule the *next* interval action *after* the current one finishes
        this.scheduleNextAction();
    }

    /**
     * Cleans up the scheduler by pausing it and releasing the callback reference.
     * Should be called when the scheduler is no longer needed to prevent memory leaks.
     */
    public cleanup(): void {
        console.log("[Scheduler] Cleaning up...");
        this.pause(); // Stops timer and sets isRunning to false
        this.onIntervalEndCallback = null; // Release callback
    }
} 
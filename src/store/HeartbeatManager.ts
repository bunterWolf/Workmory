// Import necessary classes and types
import { BrowserWindow } from 'electron';
import { ActivityFacade } from './ActivityFacade';
import { HeartbeatData } from './ActivityStore'; // Import only the type from ActivityStore
import ActiveWindowWatcher from '../watchers/ActiveWindowWatcher';
import InactivityWatcher from '../watchers/InactivityWatcher';
// import TeamsMeetingsWatcher from '../watchers/TeamsMeetingsWatcher'; // If re-enabled later

// Define a common interface for watchers (adjust methods/properties as needed)
interface Watcher {
  init(mainWindow?: BrowserWindow): Promise<void>; // Add optional mainWindow if needed by some watchers
  getHeartbeatData(): Promise<Partial<HeartbeatData>>; // Return partial data specific to the watcher
  cleanup(): void;
}

// Define options for the constructor
interface HeartbeatManagerOptions {
  activityFacade: ActivityFacade;
  mainWindow: BrowserWindow;
}

/**
 * Manages heartbeat generation and orchestrates all watchers.
 */
class HeartbeatManager {
  // ---- CLASS PROPERTY DECLARATIONS ----
  private activityFacade: ActivityFacade;
  private mainWindow: BrowserWindow;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isInitialized: boolean = false;
  private shouldCheckHeartbeatTime: boolean = true; // Flag for timing logic

  // Watcher instances (typed)
  private activeWindowWatcher: ActiveWindowWatcher;
  private inactivityWatcher: InactivityWatcher;
  // private teamsMeetingsWatcher: TeamsMeetingsWatcher; // If re-enabled later

  // Array of all active watchers (typed)
  private watchers: Watcher[];

  /**
   * Initialize the HeartbeatManager
   * @param {HeartbeatManagerOptions} options - Configuration options
   */
  constructor(options: HeartbeatManagerOptions) {
    if (!options || !options.activityFacade || !options.mainWindow) {
      throw new Error('HeartbeatManager requires activityFacade and mainWindow in options');
    }
    this.activityFacade = options.activityFacade;
    this.mainWindow = options.mainWindow;

    // Initialize watcher instances
    this.activeWindowWatcher = new ActiveWindowWatcher();
    this.inactivityWatcher = new InactivityWatcher();
    // this.teamsMeetingsWatcher = new TeamsMeetingsWatcher(); // If re-enabled later

    // Store all watchers in the array (ensure they conform to Watcher interface)
    this.watchers = [
      this.activeWindowWatcher,
      this.inactivityWatcher,
      // this.teamsMeetingsWatcher, // If re-enabled later
    ];

    // Initial state setup
    this.heartbeatInterval = null;
    this.isRunning = false;
    this.isInitialized = false;
    this.shouldCheckHeartbeatTime = true;
  }

  /**
   * Initialize all watchers asynchronously.
   * @returns {Promise<void>}
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.log('HeartbeatManager watchers already initialized.');
      return;
    }

    console.log('Initializing HeartbeatManager watchers...');

    try {
      // Initialize each watcher. Use Promise.all for concurrency.
      // Note: inactivityWatcher.init now expects mainWindow based on previous code.
      // Ensure init signatures match the Watcher interface.
      await Promise.all([
          this.activeWindowWatcher.init(), // Assuming init takes no args
          this.inactivityWatcher.init(this.mainWindow), // Assuming init takes mainWindow
          // this.teamsMeetingsWatcher.init(), // If re-enabled later
      ]);

      this.isInitialized = true;
      console.log('HeartbeatManager watchers initialized successfully');
    } catch (error) {
      console.error('Error initializing HeartbeatManager watchers:', error);
      // Optional: Set isInitialized to false or handle partial initialization?
      this.isInitialized = false;
      throw error; // Rethrow to indicate initialization failure
    }
  }

  /**
   * Start the heartbeat generation process.
   */
  start(): void {
    if (this.isRunning) {
      console.log('HeartbeatManager already running.');
      return;
    }
    if (!this.isInitialized) {
        console.warn('Cannot start HeartbeatManager: Watchers not initialized.');
        return;
    }

    console.log('Starting HeartbeatManager...');
    this.isRunning = true;

    // Set up interval to check for heartbeat timing every second
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeatTime();
    }, 1000);
    // Prevent Node.js from exiting if this is the only active timer
    this.heartbeatInterval.unref();
  }

  /**
   * Stop the heartbeat generation process.
   */
  stop(): void {
    if (!this.isRunning) {
      // console.log('HeartbeatManager already stopped.'); // Optional log
      return;
    }

    console.log('Stopping HeartbeatManager...');
    this.isRunning = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Check if it's time to generate a heartbeat (currently hardcoded to :15 and :45 seconds).
   */
  private checkHeartbeatTime(): void {
    if (!this.isRunning || !this.shouldCheckHeartbeatTime) {
      return;
    }

    const now = new Date();
    const seconds = now.getSeconds();

    // Trigger heartbeat generation at specific seconds
    if (seconds === 15 || seconds === 45) {
      // Temporarily disable checking to prevent double triggers within the same second
      this.shouldCheckHeartbeatTime = false;
      // Use Promise.resolve to handle async generateHeartbeat without blocking interval
      Promise.resolve(this.generateHeartbeat()).catch(err => {
           console.error("Error during async generateHeartbeat called from checkHeartbeatTime:", err);
      });

      // Re-enable check after 1 second
      setTimeout(() => {
        this.shouldCheckHeartbeatTime = true;
      }, 1000);
    }
  }

  /**
   * Collect data from all registered watchers for a heartbeat.
   * @returns {Promise<HeartbeatData>} Combined heartbeat data object.
   */
  private async collectHeartbeatData(): Promise<HeartbeatData> {
    if (!this.isInitialized) {
      console.warn('Attempted to collect heartbeat data before watchers were initialized.');
      // Return empty data or throw error? Returning empty for now.
      return {};
    }

    try {
      // Collect data from each watcher in parallel
      // The result is an array of Partial<HeartbeatData>
      const results: Partial<HeartbeatData>[] = await Promise.all(
        this.watchers.map(watcher => watcher.getHeartbeatData())
      );

      // Merge all partial data objects into a single HeartbeatData object
      // Start with an empty object to avoid modifying the first result object
      const combinedData: HeartbeatData = Object.assign({}, ...results);
      return combinedData;
    } catch (error) {
      console.error('Error collecting heartbeat data from watchers:', error);
      // Return empty data or throw error? Returning empty for now.
      return {};
    }
  }

  /**
   * Generate a single heartbeat by collecting data and sending it to the ActivityFacade.
   */
  private async generateHeartbeat(): Promise<void> {
    if (!this.isRunning || !this.activityFacade) {
        if (!this.isRunning) console.warn("generateHeartbeat called while not running.");
        if (!this.activityFacade) console.warn("generateHeartbeat called without activityFacade.");
      return;
    }

    try {
      // Collect data from all watchers
      const heartbeatData = await this.collectHeartbeatData();

      if (Object.keys(heartbeatData).length === 0) {
          console.warn("Skipping heartbeat generation: No data collected from watchers.");
          return;
      }

      // Log the collected data with pretty-printing (indentation)
      console.log('Generated Heartbeat:', JSON.stringify(heartbeatData, null, 2));

      // Add the combined heartbeat data to the activity facade
      this.activityFacade.addHeartbeat(heartbeatData);
    } catch (error) {
      console.error('Error generating or adding heartbeat:', error);
    }
  }

  /**
   * Clean up resources: stop the interval and clean up each watcher.
   */
  cleanup(): void {
    console.log('Cleaning up HeartbeatManager...');
    this.stop(); // Stop the heartbeat interval

    // Clean up each registered watcher
    console.log('Cleaning up watchers...');
    this.watchers.forEach((watcher: Watcher) => {
      try {
        // Check if cleanup method exists before calling (optional safety)
        if (typeof watcher.cleanup === 'function') {
            watcher.cleanup();
        }
      } catch (error) {
        // Log error for specific watcher cleanup failure
        const watcherName = watcher.constructor?.name || 'UnknownWatcher';
        console.error(`Error cleaning up watcher ${watcherName}:`, error);
      }
    });

    this.isInitialized = false; // Mark as no longer initialized
    console.log('HeartbeatManager cleaned up successfully.');
  }
}

// Export the class using ES module syntax
export default HeartbeatManager; 
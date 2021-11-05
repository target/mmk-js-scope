import { Job } from "bull";

declare module "hooks";

declare module "bull" {
  export interface Queue {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nextJobFromJobData: (jobData: any, jobId?: string) => Job | null;
  }
}

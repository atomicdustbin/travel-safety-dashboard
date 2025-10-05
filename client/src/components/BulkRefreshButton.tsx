import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Database, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

interface BulkJobProgress {
  jobId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  totalCountries: number;
  processedCountries: number;
  failedCountries: number;
  currentCountry: string | null;
  startedAt: string;
  completedAt: string | null;
  errors: Array<{ country: string; error: string }>;
}

export function BulkRefreshButton() {
  const [showDialog, setShowDialog] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Mutation to trigger bulk refresh
  const startRefreshMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/refresh-advisories");
      const data = await response.json() as { jobId: string; message: string };
      return data;
    },
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      setShowDialog(true);
    },
    onError: (error: any) => {
      console.error("Failed to start bulk refresh:", error);
    },
  });

  // Query to monitor job progress
  const { data: jobProgress, refetch: refetchProgress } = useQuery({
    queryKey: ["/api/refresh-status", activeJobId],
    queryFn: async () => {
      if (!activeJobId) return null;
      const response = await fetch(`/api/refresh-status/${activeJobId}`);
      if (!response.ok) throw new Error("Failed to fetch job status");
      return response.json() as Promise<BulkJobProgress>;
    },
    enabled: !!activeJobId && showDialog,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Refetch every 2 seconds if job is running, stop if completed/failed/cancelled
      return data?.status === 'running' ? 2000 : false;
    },
  });

  // Mutation to cancel job
  const cancelJobMutation = useMutation({
    mutationFn: async () => {
      if (!activeJobId) throw new Error("No active job");
      await apiRequest("POST", `/api/refresh-cancel/${activeJobId}`);
    },
    onSuccess: () => {
      refetchProgress();
    },
  });

  const handleStartRefresh = () => {
    startRefreshMutation.mutate();
  };

  const handleCancel = () => {
    cancelJobMutation.mutate();
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    if (jobProgress?.status !== 'running') {
      setActiveJobId(null);
    }
  };

  const progressPercentage = jobProgress
    ? Math.round((jobProgress.processedCountries / jobProgress.totalCountries) * 100)
    : 0;

  const getStatusBadge = () => {
    if (!jobProgress) return null;

    switch (jobProgress.status) {
      case 'running':
        return (
          <Badge variant="default" className="bg-blue-500" data-testid="badge-status-running">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Running
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-500" data-testid="badge-status-completed">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" data-testid="badge-status-failed">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="secondary" data-testid="badge-status-cancelled">
            <AlertCircle className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        );
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleStartRefresh}
        disabled={startRefreshMutation.isPending || jobProgress?.status === 'running'}
        className="gap-2"
        data-testid="button-bulk-refresh"
      >
        <Database className="w-4 h-4" />
        <span className="hidden sm:inline">Refresh US State Dept Data</span>
        <span className="sm:hidden">Refresh Data</span>
      </Button>

      <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-bulk-progress">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Bulk Data Refresh
              {getStatusBadge()}
            </DialogTitle>
            <DialogDescription>
              Downloading and AI-enhancing US State Department travel advisories for all countries
            </DialogDescription>
          </DialogHeader>

          {jobProgress && (
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium" data-testid="text-progress-percentage">
                    {progressPercentage}%
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" data-testid="progress-bar" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span data-testid="text-processed-count">
                    {jobProgress.processedCountries} / {jobProgress.totalCountries} countries processed
                  </span>
                  {jobProgress.failedCountries > 0 && (
                    <span className="text-destructive" data-testid="text-failed-count">
                      {jobProgress.failedCountries} failed
                    </span>
                  )}
                </div>
              </div>

              {/* Current Country */}
              {jobProgress.currentCountry && jobProgress.status === 'running' && (
                <div className="bg-muted rounded-lg p-3" data-testid="current-country-indicator">
                  <div className="text-sm text-muted-foreground mb-1">Currently processing</div>
                  <div className="font-medium flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    {jobProgress.currentCountry}
                  </div>
                </div>
              )}

              {/* Completed Message */}
              {jobProgress.status === 'completed' && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4" data-testid="completion-message">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-green-900 dark:text-green-100">
                        Refresh Completed Successfully
                      </div>
                      <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                        All {jobProgress.processedCountries} countries have been updated with the latest travel advisories and AI enhancements.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Failed Message */}
              {jobProgress.status === 'failed' && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4" data-testid="failure-message">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-destructive mt-0.5" />
                    <div>
                      <div className="font-medium text-destructive">
                        Refresh Failed
                      </div>
                      <div className="text-sm text-destructive/80 mt-1">
                        The bulk refresh encountered an error. You can retry the operation.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cancelled Message */}
              {jobProgress.status === 'cancelled' && (
                <div className="bg-muted border border-border rounded-lg p-4" data-testid="cancellation-message">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">
                        Refresh Cancelled
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        The bulk refresh was cancelled. Progress has been saved.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Log (if there are errors) */}
              {jobProgress.errors && jobProgress.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-destructive">Errors ({jobProgress.errors.length})</div>
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 max-h-40 overflow-y-auto" data-testid="error-log">
                    <ul className="space-y-1 text-xs text-destructive/90">
                      {jobProgress.errors.slice(0, 10).map((error, index) => (
                        <li key={index}>
                          <span className="font-medium">{error.country}:</span> {error.error}
                        </li>
                      ))}
                      {jobProgress.errors.length > 10 && (
                        <li className="text-muted-foreground">
                          ... and {jobProgress.errors.length - 10} more errors
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                {jobProgress.status === 'running' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={cancelJobMutation.isPending}
                    data-testid="button-cancel-job"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  variant={jobProgress.status === 'running' ? 'ghost' : 'default'}
                  size="sm"
                  onClick={handleCloseDialog}
                  data-testid="button-close-dialog"
                >
                  {jobProgress.status === 'running' ? 'Run in Background' : 'Close'}
                </Button>
              </div>
            </div>
          )}

          {/* Loading State (when mutation is pending but no job data yet) */}
          {startRefreshMutation.isPending && !jobProgress && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

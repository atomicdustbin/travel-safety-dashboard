import { Card, CardContent } from "@/components/ui/card";

interface LoadingStateProps {
  count?: number;
}

export function LoadingState({ count = 3 }: LoadingStateProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-testid="loading-state">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="overflow-hidden" data-testid={`loading-card-${index}`}>
          <CardContent className="p-6">
            <div className="animate-pulse">
              <div className="h-6 w-32 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 w-full bg-gray-200 rounded mb-2"></div>
              <div className="h-4 w-3/4 bg-gray-200 rounded mb-4"></div>
              <div className="space-y-3">
                <div className="h-20 w-full bg-gray-200 rounded"></div>
                <div className="h-16 w-full bg-gray-200 rounded"></div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-4 w-full bg-gray-200 rounded"></div>
                  <div className="h-4 w-full bg-gray-200 rounded"></div>
                  <div className="h-4 w-full bg-gray-200 rounded"></div>
                  <div className="h-4 w-full bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

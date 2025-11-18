import { Layout } from "@/components/layout";
import { GlassCard } from "@/components/ui/glass-card";
import { Calendar, Download, MoreHorizontal, Share2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import type { Edit } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

import { useLocation } from "wouter";

export default function History() {
  const [, setLocation] = useLocation();
  const { data: edits, isLoading } = useQuery<Edit[]>({
    queryKey: ["/api/history"]
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center pt-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-2">Your Edits</h1>
            <p className="text-muted-foreground">Manage your past masterpieces.</p>
          </div>
        </div>

        {edits && edits.length === 0 ? (
           <div className="text-center py-20">
             <p className="text-muted-foreground">No edits yet. Go create some magic!</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {edits?.map((item) => (
              <GlassCard 
                key={item.id} 
                className="p-0 overflow-hidden group flex flex-col h-full cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                onClick={() => setLocation(`/editor?id=${item.id}`)}
              >
                <div className="aspect-[4/3] relative overflow-hidden bg-black/5">
                  <img 
                    src={item.imageUrl} 
                    alt={item.prompt}
                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${item.status === 'completed' ? 'filter contrast-125 saturate-125 brightness-110' : ''}`}
                  />
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Download className="w-4 h-4 mr-2" /> Download
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Share2 className="w-4 h-4 mr-2" /> Share
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {item.status === 'pending' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white font-medium text-sm">
                      Draft
                    </div>
                  )}
                </div>
                
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-medium text-foreground line-clamp-2 leading-snug">
                      {item.prompt || "Untitled Draft"}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/50">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full capitalize ${item.status === 'completed' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

import { Layout } from "@/components/layout";
import { GlassCard } from "@/components/ui/glass-card";
import { SAMPLE_HISTORY } from "@/lib/mock-data";
import { Calendar, Download, MoreHorizontal, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function History() {
  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-2">Your Edits</h1>
            <p className="text-muted-foreground">Manage your past masterpieces.</p>
          </div>
          <Button variant="outline">Clear History</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SAMPLE_HISTORY.map((item) => (
            <GlassCard key={item.id} className="p-0 overflow-hidden group flex flex-col h-full">
              <div className="aspect-[4/3] relative overflow-hidden">
                <img 
                  src={item.image} 
                  alt={item.prompt}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
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
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-medium text-foreground line-clamp-2 leading-snug">
                    {item.prompt}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/50">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {item.date}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">
                    {item.type}
                  </span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </Layout>
  );
}

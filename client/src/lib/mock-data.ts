export interface HistoryItem {
  id: string;
  image: string;
  prompt: string;
  date: string;
  type: "edit" | "generate";
}

export const SAMPLE_HISTORY: HistoryItem[] = [
  {
    id: "1",
    image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&auto=format&fit=crop&q=60",
    prompt: "Enhance colors and add dramatic lighting",
    date: "2 mins ago",
    type: "edit"
  },
  {
    id: "2",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&auto=format&fit=crop&q=60",
    prompt: "Remove background, keep subject",
    date: "1 hour ago",
    type: "edit"
  },
  {
    id: "3",
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=60",
    prompt: "Turn into a watercolor painting",
    date: "Yesterday",
    type: "generate"
  }
];

export const SUGGESTION_CHIPS = [
  "Enhance colors",
  "Remove background",
  "Make it cinematic",
  "Fix lighting",
  "Remove objects",
  "Portrait mode"
];

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
    image: "https://images.unsplash.com/photo-1733640749505-ec95877d8f47?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    prompt: "Enhance colors and add dramatic lighting",
    date: "2 mins ago",
    type: "edit"
  },
  {
    id: "2",
    image: "https://images.unsplash.com/photo-1689669500646-acf8b311af2c?q=80&w=1171&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    prompt: "Remove background, keep subject",
    date: "1 hour ago",
    type: "edit"
  },
  {
    id: "3",
    image: "https://images.unsplash.com/photo-1674034259214-3adb4773370e?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
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

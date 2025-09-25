export interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  youtubeId: string;
  duration?: string;
  category?: string;
}

export const employeeVideos: Video[] = [
  {
    id: '1',
    title: 'Comment remplir les formulaires efficacement',
    description: 'Apprenez les meilleures pratiques pour remplir vos formulaires de manière efficace et éviter les erreurs courantes.',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    youtubeId: 'dQw4w9WgXcQ', // Replace with actual YouTube video ID
    duration: '5:30',
    category: 'Formation'
  },
  {
    id: '2',
    title: 'Ubora-Archa',
    description: 'Comment l’application UBORA vous aide a analyser vos rapports.',
    thumbnail: 'https://img.youtube.com/vi/elmDZt12ees/maxresdefault.jpg',
    youtubeId: 'elmDZt12ees',
    duration: '0:60', // YouTube Shorts are typically under 60 seconds
    category: 'Formation'
  },
];

export const directorVideos: Video[] = [
  {
    id: '2',
    title: 'Ubora-Archa',
    description: 'Comment l’application UBORA vous aide a analyser vos rapports.',
    thumbnail: 'https://img.youtube.com/vi/elmDZt12ees/maxresdefault.jpg',
    youtubeId: 'elmDZt12ees',
    duration: '0:60', // YouTube Shorts are typically under 60 seconds
    category: 'Formation'
  },
];

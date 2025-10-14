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
    title: 'Ubora-Archa',
    description: 'Comment l\'application UBORA vous aide a analyser vos rapports.',
    thumbnail: 'https://img.youtube.com/vi/elmDZt12ees/maxresdefault.jpg',
    youtubeId: 'elmDZt12ees',
    duration: '0:60', // YouTube Shorts are typically under 60 seconds
    category: 'Formation'
  },
  {
    id: '2',
    title: '3 minutes pour tout savoir sur l\'interface UBORA',
    description: 'Dans cette vidéo on présente UBORA. Une application Web d\'assistant au pilotage des entreprises. Elle analyse vos rapports et vos données pour répondre à vos questions et à vous alerter.',
    thumbnail: 'https://img.youtube.com/vi/3CsEW9AFGDg/maxresdefault.jpg',
    youtubeId: '3CsEW9AFGDg',
    duration: '3:00',
    category: 'Formation'
  },
];

export const directorVideos: Video[] = [
  {
    id: '1',
    title: 'Ubora-Archa',
    description: 'Comment l\'application UBORA vous aide a analyser vos rapports.',
    thumbnail: 'https://img.youtube.com/vi/elmDZt12ees/maxresdefault.jpg',
    youtubeId: 'elmDZt12ees',
    duration: '0:60', // YouTube Shorts are typically under 60 seconds
    category: 'Formation'
  },
  {
    id: '2',
    title: '3 minutes pour tout savoir sur l\'interface UBORA',
    description: 'Dans cette vidéo on présente UBORA. Une application Web d\'assistant au pilotage des entreprises. Elle analyse vos rapports et vos données pour répondre à vos questions et à vous alerter.',
    thumbnail: 'https://img.youtube.com/vi/3CsEW9AFGDg/maxresdefault.jpg',
    youtubeId: '3CsEW9AFGDg',
    duration: '3:00',
    category: 'Formation'
  },
];

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
    title: 'Gestion du temps et des priorités',
    description: 'Découvrez des techniques pour mieux organiser votre temps et gérer vos priorités au travail.',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    youtubeId: 'dQw4w9WgXcQ', // Replace with actual YouTube video ID
    duration: '8:15',
    category: 'Productivité'
  },
  {
    id: '3',
    title: 'Communication professionnelle',
    description: 'Améliorez vos compétences en communication pour une meilleure collaboration avec vos collègues.',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    youtubeId: 'dQw4w9WgXcQ', // Replace with actual YouTube video ID
    duration: '12:45',
    category: 'Communication'
  },
  {
    id: '4',
    title: 'Sécurité au travail',
    description: 'Rappel des règles de sécurité essentielles à respecter dans votre environnement de travail.',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    youtubeId: 'dQw4w9WgXcQ', // Replace with actual YouTube video ID
    duration: '6:20',
    category: 'Sécurité'
  }
];

export const directorVideos: Video[] = [
  {
    id: '1',
    title: 'Gestion d\'équipe et leadership',
    description: 'Découvrez les techniques de leadership modernes pour motiver et diriger efficacement votre équipe.',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    youtubeId: 'dQw4w9WgXcQ', // Replace with actual YouTube video ID
    duration: '15:30',
    category: 'Leadership'
  },
  {
    id: '2',
    title: 'Création de formulaires avancés',
    description: 'Apprenez à créer des formulaires complexes avec des conditions et des validations avancées.',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    youtubeId: 'dQw4w9WgXcQ', // Replace with actual YouTube video ID
    duration: '12:45',
    category: 'Formation'
  },
  {
    id: '3',
    title: 'Analyse des données et rapports',
    description: 'Maîtrisez l\'analyse des données collectées et la génération de rapports efficaces.',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    youtubeId: 'dQw4w9WgXcQ', // Replace with actual YouTube video ID
    duration: '18:20',
    category: 'Analytics'
  },
  {
    id: '4',
    title: 'Gestion des performances d\'équipe',
    description: 'Techniques pour évaluer et améliorer les performances de votre équipe.',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    youtubeId: 'dQw4w9WgXcQ', // Replace with actual YouTube video ID
    duration: '14:15',
    category: 'Management'
  },
  {
    id: '5',
    title: 'Communication managériale',
    description: 'Améliorez vos compétences en communication pour une meilleure gestion d\'équipe.',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    youtubeId: 'dQw4w9WgXcQ', // Replace with actual YouTube video ID
    duration: '11:30',
    category: 'Communication'
  }
];

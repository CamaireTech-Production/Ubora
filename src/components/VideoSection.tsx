import React, { useState } from 'react';
import { Card } from './Card';
import { Play, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Video } from '../data/videoData';

interface VideoSectionProps {
  title?: string;
  videos: Video[];
  className?: string;
}

export const VideoSection: React.FC<VideoSectionProps> = ({ 
  title = "Vidéos de formation", 
  videos, 
  className = "" 
}) => {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  const openVideo = (video: Video) => {
    setSelectedVideo(video);
  };

  const closeVideo = () => {
    setSelectedVideo(null);
  };

  const scrollLeft = () => {
    const container = document.getElementById('video-scroll-container');
    if (container) {
      const scrollAmount = 320;
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    const container = document.getElementById('video-scroll-container');
    if (container) {
      const scrollAmount = 320;
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const getEmbedUrl = (youtubeId: string) => {
    return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`;
  };

  const getThumbnailUrl = (youtubeId: string) => {
    return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
  };

  if (videos.length === 0) {
    return null;
  }

  return (
    <>
      <Card title={title} className={className}>
        <div className="relative">
          <div 
            id="video-scroll-container"
            className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide video-scroll-container"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {videos.map((video) => (
              <div
                key={video.id}
                className="flex-shrink-0 w-80 bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200 hover:border-blue-300 cursor-pointer video-card"
                onClick={() => openVideo(video)}
              >
                {/* Thumbnail */}
                <div className="relative">
                  <img
                    src={getThumbnailUrl(video.youtubeId)}
                    alt={video.title}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      // Fallback to a default thumbnail if the image fails to load
                      (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;
                    }}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                    <div className="bg-red-600 rounded-full p-3 hover:bg-red-700 transition-colors">
                      <Play className="h-6 w-6 text-white ml-1" />
                    </div>
                  </div>
                  {video.duration && (
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                      {video.duration}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
                    {video.title}
                  </h3>
                  <p className="text-xs text-gray-600 line-clamp-3">
                    {video.description}
                  </p>
                  {video.category && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {video.category}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Scroll indicators */}
          {videos.length > 1 && (
            <>
              <div 
                className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-4 bg-white border border-gray-300 rounded-full p-2 shadow-lg cursor-pointer hover:bg-gray-50 transition-colors hidden md:flex items-center justify-center"
                onClick={scrollLeft}
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </div>
              <div 
                className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-4 bg-white border border-gray-300 rounded-full p-2 shadow-lg cursor-pointer hover:bg-gray-50 transition-colors hidden md:flex items-center justify-center"
                onClick={scrollRight}
              >
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Video Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 line-clamp-2">
                {selectedVideo.title}
              </h2>
              <button
                onClick={closeVideo}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Video Content */}
            <div className="p-4">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={getEmbedUrl(selectedVideo.youtubeId)}
                  title={selectedVideo.title}
                  className="absolute top-0 left-0 w-full h-full rounded-lg"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              {/* Video Description */}
              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  {selectedVideo.description}
                </p>
                {selectedVideo.category && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {selectedVideo.category}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

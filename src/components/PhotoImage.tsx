import React, { useState, useEffect } from 'react';
import { Image } from 'antd';

interface PhotoImageProps {
  src: string;
  width?: number | string;
  alt?: string;
  className?: string;
}

const PhotoImage: React.FC<PhotoImageProps> = ({ src, width, alt, className }) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImage = async () => {
      setLoading(true);
      try {
        const dataUrl = await window.electron.ipcRenderer.invoke('load-image', src);
        if (dataUrl) {
          setImageSrc(dataUrl);
        }
      } catch (error) {
        console.error('Failed to load image:', error);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [src]);

  if (loading) {
    return <div style={{ width, height: width, background: '#f0f0f0' }} />;
  }

  return (
    <Image
      src={imageSrc}
      width={width}
      alt={alt}
      className={className}
      preview={{
        mask: 'Preview',
      }}
    />
  );
};

export default PhotoImage;
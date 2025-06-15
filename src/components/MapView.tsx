import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import '../leafletConfig';
import { PhotoData } from '../types';
import PhotoImage from './PhotoImage';

interface MapViewProps {
  photos: PhotoData[];
  onPhotosSelected: (photos: PhotoData[]) => void;
  selectedPhotos: PhotoData[];
}

const RectangleSelector: React.FC<{ onSelect: (bounds: L.LatLngBounds) => void }> = ({ onSelect }) => {
  const [startPoint, setStartPoint] = useState<L.LatLng | null>(null);
  const [rectangle, setRectangle] = useState<L.Rectangle | null>(null);
  const [isRightMouseDown, setIsRightMouseDown] = useState(false);
  
  const map = useMapEvents({
    mousedown: (e) => {
      // Check if right mouse button (button = 2)
      if (e.originalEvent.button === 2) {
        e.originalEvent.preventDefault();
        setIsRightMouseDown(true);
        setStartPoint(e.latlng);
        const rect = L.rectangle([[e.latlng, e.latlng]], {
          color: '#3388ff',
          weight: 2,
          opacity: 0.5,
          fillOpacity: 0.2,
        });
        rect.addTo(map);
        setRectangle(rect);
      }
    },
    mousemove: (e) => {
      if (isRightMouseDown && startPoint && rectangle) {
        const bounds = L.latLngBounds(startPoint, e.latlng);
        rectangle.setBounds(bounds);
      }
    },
    mouseup: (e) => {
      if (isRightMouseDown && startPoint && rectangle) {
        const bounds = L.latLngBounds(startPoint, e.latlng);
        onSelect(bounds);
        map.removeLayer(rectangle);
        setStartPoint(null);
        setRectangle(null);
        setIsRightMouseDown(false);
      }
    },
    contextmenu: (e) => {
      // Prevent context menu from appearing during right-click drag
      e.originalEvent.preventDefault();
    },
  });
  
  return null;
};

const createPhotoIcon = (isSelected: boolean) => {
  return L.divIcon({
    className: `photo-marker ${isSelected ? 'selected' : ''}`,
    html: '<div>📷</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

const MapView: React.FC<MapViewProps> = ({ photos, onPhotosSelected, selectedPhotos }) => {
  const mapRef = useRef<L.Map | null>(null);
  const [center] = useState<[number, number]>([51.505, -0.09]);
  const [zoom] = useState(13);

  useEffect(() => {
    if (photos.length > 0 && mapRef.current) {
      const bounds = L.latLngBounds(photos.map(p => [p.lat, p.lng]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [photos]);

  const handleRectangleSelect = (bounds: L.LatLngBounds) => {
    const selected = photos.filter(photo => {
      const point = L.latLng(photo.lat, photo.lng);
      return bounds.contains(point);
    });
    onPhotosSelected(selected);
  };

  const isPhotoSelected = (photo: PhotoData) => {
    return selectedPhotos.some(p => p.path === photo.path);
  };

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ width: '100%', height: '100%' }}
      ref={mapRef}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {photos.map((photo) => (
        <Marker
          key={photo.path}
          position={[photo.lat, photo.lng]}
          icon={createPhotoIcon(isPhotoSelected(photo))}
          eventHandlers={{
            click: () => {
              onPhotosSelected([photo]);
            },
          }}
        >
          <Popup>
            <div style={{ textAlign: 'center' }}>
              <PhotoImage src={photo.path} width={200} alt={photo.name} />
              <p style={{ margin: '8px 0 4px' }}><strong>{photo.name}</strong></p>
              <p style={{ margin: 0, fontSize: '12px' }}>
                {photo.lat.toFixed(6)}, {photo.lng.toFixed(6)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
      <RectangleSelector onSelect={handleRectangleSelect} />
    </MapContainer>
  );
};

export default MapView;
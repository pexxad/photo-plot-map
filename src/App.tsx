import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Button, Input, Modal, List, message, Drawer } from 'antd';
import { FolderOpenOutlined, EditOutlined, MenuOutlined } from '@ant-design/icons';
import MapView from './components/MapView';
import PhotoImage from './components/PhotoImage';
import DateRangeFilter from './components/DateRangeFilter';
import { PhotoData } from './types';
import './App.css';

const { Header, Content, Sider } = Layout;

const App: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<PhotoData[]>([]);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renamePrefix, setRenamePrefix] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });

  // Debug: Check if window.electron is available
  useEffect(() => {
    console.log('window.electron available:', !!window.electron);
    if (window.electron) {
      console.log('window.electron.ipcRenderer available:', !!window.electron.ipcRenderer);
    }
  }, []);

  useEffect(() => {
    if (!window.electron || !window.electron.ipcRenderer) {
      console.error('window.electron.ipcRenderer is not available');
      return;
    }

    console.log('Setting up IPC listeners...');

    window.electron.ipcRenderer.on('photos-loaded', (photos: PhotoData[]) => {
      console.log('Received photos-loaded event with', photos.length, 'photos');
      setPhotos(photos);
      message.success(`Loaded ${photos.length} photos with location data`);
    });

    window.electron.ipcRenderer.on('photos-renamed', (count: number) => {
      console.log('Received photos-renamed event, count:', count);
      message.success(`Successfully renamed ${count} photos`);
      setSelectedPhotos([]);
      // Reload the same folder
      if (folderPath) {
        console.log('Reloading photos from folder:', folderPath);
        window.electron.ipcRenderer.send('load-photos', folderPath);
      }
    });

    window.electron.ipcRenderer.on('error', (error: string) => {
      console.error('Received error event:', error);
      message.error(error);
    });

    return () => {
      console.log('Cleaning up IPC listeners...');
      if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('photos-loaded');
        window.electron.ipcRenderer.removeAllListeners('photos-renamed');
        window.electron.ipcRenderer.removeAllListeners('error');
      }
    };
  }, [folderPath]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  // Filter photos by date range
  const filteredPhotos = useMemo(() => {
    if (!dateRange.start || !dateRange.end) {
      return photos;
    }

    return photos.filter(photo => {
      const photoDate = new Date(photo.timestamp);
      return photoDate >= dateRange.start! && photoDate <= dateRange.end!;
    });
  }, [photos, dateRange]);

  // Sort selected photos by date descending
  const sortedSelectedPhotos = useMemo(() => {
    return [...selectedPhotos].sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA; // Descending order
    });
  }, [selectedPhotos]);

  const handleSelectFolder = async () => {
    console.log('handleSelectFolder called');
    try {
      const result = await window.electron.ipcRenderer.invoke('select-folder');
      console.log('Folder selection result:', result);
      if (result) {
        setFolderPath(result);
        console.log('Sending load-photos IPC message for folder:', result);
        window.electron.ipcRenderer.send('load-photos', result);
      }
    } catch (error) {
      console.error('Error in handleSelectFolder:', error);
    }
  };

  const handleRenamePhotos = () => {
    if (!renamePrefix) {
      message.warning('Please enter a prefix for the renamed files');
      return;
    }

    const paths = selectedPhotos.map(photo => photo.path);
    window.electron.ipcRenderer.send('rename-photos', { paths, prefix: renamePrefix });
    setIsRenameModalOpen(false);
    setRenamePrefix('');
  };

  const handlePhotosSelected = (photos: PhotoData[]) => {
    setSelectedPhotos(photos);
    if (isMobile && photos.length > 0) {
      setIsMobileDrawerOpen(true);
    }
  };

  const handleDateRangeChange = (start: Date | null, end: Date | null) => {
    setDateRange({ start, end });
    // Clear selected photos when date range changes
    setSelectedPhotos([]);
  };

  const sidebarContent = (
    <>
      <div style={{ marginBottom: '20px' }}>
        <h3>Selected Photos ({selectedPhotos.length})</h3>
        {selectedPhotos.length > 0 && (
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => setIsRenameModalOpen(true)}
            style={{ width: '100%' }}
          >
            Rename Selected Photos
          </Button>
        )}
      </div>
      <List
        dataSource={sortedSelectedPhotos}
        renderItem={(photo) => {
          const photoDate = new Date(photo.timestamp);
          const dateStr = photoDate.toLocaleDateString() + ' ' + photoDate.toLocaleTimeString();
          return (
            <List.Item>
              <List.Item.Meta
                avatar={<PhotoImage width={50} src={photo.path} />}
                title={photo.name}
                description={
                  <>
                    <div>{dateStr}</div>
                    <div>{`${photo.lat.toFixed(6)}, ${photo.lng.toFixed(6)}`}</div>
                  </>
                }
              />
            </List.Item>
          );
        }}
      />
    </>
  );

  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isMobile && selectedPhotos.length > 0 && (
            <Button
              icon={<MenuOutlined />}
              onClick={() => setIsMobileDrawerOpen(true)}
            />
          )}
          <h1 style={{ margin: 0 }}>Photo Plot Map</h1>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          {photos.length > 0 && (
            <DateRangeFilter
              onDateRangeChange={handleDateRangeChange}
              disabled={photos.length === 0}
            />
          )}
          <Button
            type="primary"
            icon={<FolderOpenOutlined />}
            onClick={handleSelectFolder}
            size={isMobile ? 'small' : 'middle'}
          >
            {isMobile ? 'Select' : 'Select Folder'}
          </Button>
        </div>
      </Header>
      <Layout>
        <Content style={{ position: 'relative' }}>
          <MapView
            photos={filteredPhotos}
            onPhotosSelected={handlePhotosSelected}
            selectedPhotos={selectedPhotos}
          />
        </Content>
        {!isMobile && (
          <Sider
            width={300}
            style={{ background: '#fff', padding: '20px' }}
          >
            {sidebarContent}
          </Sider>
        )}
      </Layout>

      <Modal
        title="Rename Photos"
        open={isRenameModalOpen}
        onOk={handleRenamePhotos}
        onCancel={() => setIsRenameModalOpen(false)}
      >
        <p>Enter a prefix for the selected photos:</p>
        <Input
          placeholder="e.g., vacation"
          value={renamePrefix}
          onChange={(e) => setRenamePrefix(e.target.value)}
        />
        <p style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
          Files will be renamed to: {renamePrefix || '<prefix>'}_YYYYMMDDhhmmss.jpg
        </p>
      </Modal>

      {isMobile && (
        <Drawer
          title="Selected Photos"
          placement="right"
          onClose={() => setIsMobileDrawerOpen(false)}
          open={isMobileDrawerOpen}
          width="80%"
        >
          {sidebarContent}
        </Drawer>
      )}
    </Layout>
  );
};

export default App;
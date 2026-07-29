import React, { useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { SketchCanvas } from './canvas/SketchCanvas';
import { Dashboard } from './components/Dashboard';
import { useUIStore } from './store/useUIStore';
import { useBoardStore, setSocketForStore } from './store/useBoardStore';
import { usePresenceStore } from './store/usePresenceStore';
import { io } from 'socket.io-client';

const App: React.FC = () => {
  const { currentBoardId } = useUIStore();
  const { localUser, updateCollaborator, removeCollaborator, clearCollaborators } = usePresenceStore();
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (!currentBoardId) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketForStore(null);
      }
      clearCollaborators();
      return;
    }

    // Connect to backend Socket.IO server
    const socket = io('http://localhost:4000');
    socketRef.current = socket;
    setSocketForStore(socket);

    // Join Board Room
    socket.emit('join-board', {
      boardId: currentBoardId,
      userId: localUser.userId,
      displayName: localUser.displayName,
      avatar: localUser.avatar,
      presenceColor: localUser.presenceColor
    });

    // Realtime Sockets Presence Listeners
    socket.on('peer-join', (peer) => {
      updateCollaborator(peer.userId, peer);
    });

    socket.on('peer-list', (list: any[]) => {
      list.forEach((peer) => {
        updateCollaborator(peer.userId, peer);
      });
    });

    socket.on('peer-leave', ({ userId }) => {
      removeCollaborator(userId);
    });

    socket.on('cursor-move', (payload) => {
      updateCollaborator(payload.userId, {
        targetX: payload.x,
        targetY: payload.y,
        activeTool: payload.activeTool,
        activity: payload.activity,
        drawingElement: payload.drawingElement,
        selectedElementIds: payload.selectedElementIds,
        editingElementId: payload.editingElementId
      });
    });

    socket.on('presence-typing', (payload) => {
      updateCollaborator(payload.userId, {
        activity: payload.isTyping ? 'typing' : 'idle'
      });
    });

    // Sockets Element Synchronization Listeners
    socket.on('element-sync', (payload) => {
      const { elements, addElement, updateElement, deleteElement } = useBoardStore.getState();
      
      if (payload.type === 'create') {
        if (!elements.some(el => el.id === payload.element.id)) {
          addElement(payload.element, true);
        }
      } else if (payload.type === 'update') {
        updateElement(payload.element.id, payload.element, true);
      } else if (payload.type === 'delete') {
        deleteElement(payload.elementId, true);
      }
    });

    socket.on('board-restored', (payload) => {
      const { setElements } = useBoardStore.getState();
      setElements(payload.elements, true);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketForStore(null);
      clearCollaborators();
    };
  }, [currentBoardId, localUser, updateCollaborator, removeCollaborator, clearCollaborators]);

  if (currentBoardId === null) {
    return <Dashboard />;
  }

  return (
    <Layout>
      <div className="w-full h-full relative">
        <SketchCanvas />
      </div>
    </Layout>
  );
};

export default App;

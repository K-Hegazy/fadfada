import React from 'react';
import { useApp } from '../state/AppContext';
import { ProfileViewContent } from './ProfileViewContent';

export const UserProfileModal: React.FC = () => {
  const {
    profile: me,
    usersById,
    inspectedProfileUid,
    closeProfileModal,
    openProfileModal,
    openChatWith,
  } = useApp();

  const target = inspectedProfileUid ? usersById[inspectedProfileUid] : undefined;

  if (!inspectedProfileUid || !target || !me) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      onClick={closeProfileModal}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto fadfada-scroll rounded-xl shadow-2xl fadfada-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <ProfileViewContent
          target={target}
          onStartChat={(uid) => openChatWith(uid)}
          onInspectUser={(uid) => openProfileModal(uid)}
          onClose={closeProfileModal}
        />
      </div>
    </div>
  );
};

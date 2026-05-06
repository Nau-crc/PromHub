import React from 'react';

export const EmptyBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="empty-box">{children}</div>
);

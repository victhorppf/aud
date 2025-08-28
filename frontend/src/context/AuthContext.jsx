import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setUserData(null);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    let unsubscribeDoc;
    if (currentUser) {
      const userDocRef = doc(db, 'users', currentUser.uid);
      unsubscribeDoc = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          setUserData({ uid: currentUser.uid, ...doc.data() });
        } else {
            // This case might happen if the user doc is not created yet
            setUserData(null);
        }
        setLoading(false);
      });
    }
    return () => {
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, [currentUser]);

  const value = { currentUser, userData, loading, setLoading };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
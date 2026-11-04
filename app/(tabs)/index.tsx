import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { get, ref, set } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { database } from '../firebaseConfig';

interface Friend {
  id: string;
  name: string;
}

export default function App() {
  const mapRef = useRef<MapView>(null);
  const friendsRef = useRef<Friend[]>([]);
  const locationRef = useRef<{latitude: number, longitude: number} | null>(null);
  const [userId, setUserId] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [markers, setMarkers] = useState<{id: string, name: string, latitude: number, longitude: number}[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [inputId, setInputId] = useState('');
  const [inputName, setInputName] = useState('');

  const fetchFriendMarkers = async (friendsList: Friend[]) => {
    const newMarkers: {id: string, name: string, latitude: number, longitude: number}[] = [];
    for (const friend of friendsList) {
      const snapshot = await get(ref(database, friend.id));
      if (snapshot.exists()) {
        const data = snapshot.val().coords;
        newMarkers.push({
          id: friend.id,
          name: friend.name,
          latitude: data[0],
          longitude: data[1]
        });
      }
    }
    setMarkers(newMarkers);
  };

  useEffect(() => {
    const setup = async () => {
      // Setup ID
      let id = await AsyncStorage.getItem('address');
      if (!id) {
        id = Math.floor(Math.random() * 100000).toString();
        await AsyncStorage.setItem('address', id);
      }
      setUserId(id);

      // Load friends list
      const storedFriends = await AsyncStorage.getItem('friends');
      const friendsList: Friend[] = storedFriends ? JSON.parse(storedFriends) : [];
      setFriends(friendsList);
      friendsRef.current = friendsList;

      // Ask for location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Location permission denied');
        return;
      }

      // Get location and push immediately on startup
      const location = await Location.getCurrentPositionAsync();
      const { latitude, longitude } = location.coords;
      locationRef.current = { latitude, longitude };
      setCurrentLocation({ latitude, longitude });

      await set(ref(database, id!), {
        coords: [latitude, longitude]
      });

      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }

      // Fetch markers immediately on startup
      await fetchFriendMarkers(friendsList);

      // Watch location continuously
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 },
        (loc) => {
          const { latitude, longitude } = loc.coords;
          locationRef.current = { latitude, longitude };
          setCurrentLocation({ latitude, longitude });
        }
      );

      // Clock timer — runs every 5 seconds
      const interval = setInterval(async () => {
        const loc = locationRef.current;
        if (!loc) return;

        await set(ref(database, id!), {
          coords: [loc.latitude, loc.longitude]
        });

        await fetchFriendMarkers(friendsRef.current);
      }, 5000);

      return () => clearInterval(interval);
    };

    setup();
  }, []);

  const findMe = () => {
    if (!mapRef.current) return;
    const loc = locationRef.current ?? currentLocation;
    if (loc) {
      mapRef.current.animateToRegion({
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const openInGoogleMaps = (latitude: number, longitude: number, name: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    Linking.openURL(url);
  };

  const addFriend = async () => {
    if (!inputId.trim()) return;
    if (!inputName.trim()) {
      alert('Please enter a name for your friend!');
      return;
    }
    if (friends.some(f => f.id === inputId.trim())) {
      alert('Friend already added!');
      return;
    }

    const updated = [...friends, { id: inputId.trim(), name: inputName.trim() }];
    setFriends(updated);
    friendsRef.current = updated;
    await AsyncStorage.setItem('friends', JSON.stringify(updated));
    setInputId('');
    setInputName('');
    setModalVisible(false);
  };

  const removeFriend = async (id: string) => {
    const updated = friends.filter(f => f.id !== id);
    setFriends(updated);
    friendsRef.current = updated;
    await AsyncStorage.setItem('friends', JSON.stringify(updated));
  };

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map}>
        {markers.map(marker => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            title={marker.name}
            description={`ID: ${marker.id}`}
            pinColor="blue"
          >
          </Marker>
        ))}
      </MapView>

      {/* ID Label */}
      <View style={styles.idLabel}>
        <Text style={styles.idText}>Your ID: {userId}</Text>
      </View>

      {/* Find Me Button */}
      <TouchableOpacity style={styles.findMeButton} onPress={findMe}>
        <Text style={styles.buttonText}>📍 Find Me</Text>
      </TouchableOpacity>

      {/* Friends Button */}
      <TouchableOpacity style={styles.addFriendButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.buttonText}>➕ Friends</Text>
      </TouchableOpacity>

      {/* Friends Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Friends</Text>

            {friends.length === 0 ? (
              <Text style={{ color: '#888', marginBottom: 12 }}>No friends added yet</Text>
            ) : (
              friends.map(f => {
                const marker = markers.find(m => m.id === f.id);
                return (
                  <View key={f.id} style={styles.friendRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.friendName}>{f.name}</Text>
                      <Text style={styles.friendId}>ID: {f.id}</Text>
                    </View>
                    {/* Navigate button — only shows if we have their location */}
                    {marker && (
                      <TouchableOpacity
                        style={styles.navigateButton}
                        onPress={() => openInGoogleMaps(marker.latitude, marker.longitude, f.name)}
                      >
                        <Text style={styles.navigateText}>🧭</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => removeFriend(f.id)}>
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            <TextInput
              style={styles.input}
              placeholder="Enter friend's name"
              value={inputName}
              onChangeText={setInputName}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter friend's ID"
              value={inputId}
              onChangeText={setInputId}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.modalButton} onPress={addFriend}>
              <Text style={styles.buttonText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  idLabel: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 10,
    elevation: 5,
  },
  idText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  findMeButton: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 25,
    elevation: 5,
  },
  addFriendButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 25,
    elevation: 5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBox: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    width: '100%',
    marginBottom: 12,
    fontSize: 16,
  },
  modalButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalCancel: {
    padding: 8,
  },
  cancelText: {
    color: '#888',
    fontSize: 14,
  },
  friendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 4,
  },
  friendName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  friendId: {
    fontSize: 12,
    color: '#888',
  },
  navigateButton: {
    backgroundColor: '#f0f0f0',
    padding: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  navigateText: {
    fontSize: 18,
  },
  removeText: {
    color: 'red',
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
});
import React from 'react';
import { View, Text, Image } from 'react-native';
import styles from './styles';

const BuzzScreen = ({ route }) => {
  const { pressedButtons } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pressed Buttons:</Text>
      {pressedButtons.map((button, index) => (
        <Text key={index}>{button}</Text>
      ))}

      {/* Google Map Placeholder */}
      <View style={styles.mapContainer}>
        <Image 
          style={styles.map}
          source={{ uri: 'https://maps.googleapis.com/maps/api/staticmap?center=47.6062,-122.3321&zoom=15&size=400x400&key=YOUR_GOOGLE_MAPS_API_KEY' }}
        />
        <Text style={{position: 'absolute', zIndex: 1, color: 'grey'}}>Google Maps Placeholder</Text>
      </View>
    </View>
  );
};

export default BuzzScreen;

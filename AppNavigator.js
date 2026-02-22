// AppNavigator.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './HomeScreen';
import Renovations from './Renovations';
// ... import other screens

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator initialRouteName="Home">
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Renovations" component={Renovations} />
      {/* ... other screen components */}
    </Stack.Navigator>
  );
};

export default AppNavigator;

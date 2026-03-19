/**
 * EcoWoods Hardwood Flooring App
 * Main entry point with navigation setup.
 */

import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import useStore from './context/useStore';
import { COLORS } from './styles';

// Screens
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import JobRequestScreen from './screens/JobRequestScreen';
import RequestEstimateScreen from './screens/RequestEstimateScreen';
import PlacedOrdersScreen from './screens/PlacedOrdersScreen';
import BidsScreen from './screens/BidsScreen';
import BidDetailScreen from './screens/BidDetailScreen';
import CalendarScreen from './screens/CalendarScreen';
import AccountScreen from './screens/AccountScreen';

const Stack = createStackNavigator();

const screenOptions = {
    headerStyle: {
        backgroundColor: COLORS.primary,
        elevation: 0,
        shadowOpacity: 0,
    },
    headerTintColor: COLORS.white,
    headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
    },
    headerBackTitleVisible: false,
    cardStyle: { backgroundColor: COLORS.offWhite },
};

function AuthStack() {
    return (
        <Stack.Navigator screenOptions={{ ...screenOptions, headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
    );
}

function MainStack() {
    return (
        <Stack.Navigator screenOptions={screenOptions}>
            <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="JobRequest"
                component={JobRequestScreen}
                options={{ title: 'New Job Request' }}
            />
            <Stack.Screen
                name="RequestEstimate"
                component={RequestEstimateScreen}
                options={{ title: 'Request Estimate' }}
            />
            <Stack.Screen
                name="PlacedOrders"
                component={PlacedOrdersScreen}
                options={{ title: 'My Job Requests' }}
            />
            <Stack.Screen
                name="Bids"
                component={BidsScreen}
                options={{ title: 'Bids' }}
            />
            <Stack.Screen
                name="BidDetail"
                component={BidDetailScreen}
                options={{ title: 'Bid Details' }}
            />
            <Stack.Screen
                name="Calendar"
                component={CalendarScreen}
                options={{ title: 'Calendar' }}
            />
            <Stack.Screen
                name="Account"
                component={AccountScreen}
                options={{ title: 'My Account' }}
            />
        </Stack.Navigator>
    );
}

export default function App() {
    const { isAuthenticated, isLoading, initAuth } = useStore();

    useEffect(() => {
        initAuth();
    }, []);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
                <ActivityIndicator size="large" color={COLORS.white} />
            </View>
        );
    }

    return (
        <NavigationContainer>
            {isAuthenticated ? <MainStack /> : <AuthStack />}
        </NavigationContainer>
    );
}

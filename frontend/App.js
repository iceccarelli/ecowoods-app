/**
 * EcoWoods Hardwood Flooring App — v4.0 Production Architecture
 * ─────────────────────────────────────────────────────────────────
 * • Bottom Tab Navigator + nested Stack per tab (Instagram pattern)
 * • Each tab keeps its own back-stack history (zero lost context)
 * • Realtime sync via Socket.io (job:updated, bid:created/updated)
 * • Push notifications via expo-notifications (badge counts + banners)
 * • Deep linking (ecowoods:// + https://ecowoodshardwood.com)
 * • TanStack Query for server cache + AppState foreground refresh
 * • Haptic feedback on every tab press (selection feedback)
 * • SafeArea + GestureHandler at the root for new architecture
 * • Themed NavigationContainer matches brand
 *
 * File location: frontend/App.js  (replace existing)
 */

import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  View,
  StatusBar,
  Platform,
  AppState,
} from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';

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

/* ==========================================================================
   QUERY CLIENT — global server-state cache for the whole app
   ========================================================================== */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 2,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: 1 },
  },
});

/* ==========================================================================
   NOTIFICATION HANDLER — show banners + play sounds while app is foreground
   ========================================================================== */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/* ==========================================================================
   NAV THEME — brand-aware
   ========================================================================== */
const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.offWhite,
    card: COLORS.primary,
    text: COLORS.white,
    primary: COLORS.accent,
    border: 'transparent',
    notification: COLORS.accent,
  },
};

/* ==========================================================================
   DEEP LINKING — ecowoods://bids/42, https://ecowoodshardwood.com/jobs/7, etc.
   ========================================================================== */
const linking = {
  prefixes: [
    Linking.createURL('/'),
    'ecowoods://',
    'https://ecowoodshardwood.com',
    'https://www.ecowoodshardwood.com',
  ],
  config: {
    screens: {
      MainTabs: {
        screens: {
          HomeTab: {
            screens: {
              Home: 'home',
              JobRequest: 'request',
              RequestEstimate: 'estimate/:jobId',
            },
          },
          JobsTab: {
            screens: {
              PlacedOrders: 'jobs',
              RequestEstimate: 'jobs/:jobId',
            },
          },
          BidsTab: {
            screens: {
              Bids: 'bids',
              BidDetail: 'bids/:bidId',
            },
          },
          CalendarTab: { screens: { Calendar: 'calendar' } },
          AccountTab: { screens: { Account: 'account' } },
        },
      },
      Login: 'login',
      Register: 'register',
    },
  },
};

/* ==========================================================================
   SHARED STACK OPTIONS — applied to every stack navigator
   ========================================================================== */
const stackScreenOptions = {
  headerStyle: {
    backgroundColor: COLORS.primary,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 0,
  },
  headerTintColor: COLORS.white,
  headerTitleStyle: { fontWeight: '700', fontSize: 18 },
  headerBackTitleVisible: false,
  cardStyle: { backgroundColor: COLORS.offWhite },
  gestureEnabled: true,
};

/* ==========================================================================
   AUTH STACK — Login / Register, headers hidden
   ========================================================================== */
const AuthStackNav = createStackNavigator();
function AuthStack() {
  return (
    <AuthStackNav.Navigator
      screenOptions={{ ...stackScreenOptions, headerShown: false }}
    >
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
      <AuthStackNav.Screen name="Register" component={RegisterScreen} />
    </AuthStackNav.Navigator>
  );
}

/* ==========================================================================
   PER-TAB STACKS — each tab owns its own navigation history
   ========================================================================== */
const HomeStackNav = createStackNavigator();
function HomeStack() {
  return (
    <HomeStackNav.Navigator screenOptions={stackScreenOptions}>
      <HomeStackNav.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <HomeStackNav.Screen
        name="JobRequest"
        component={JobRequestScreen}
        options={{ title: 'New Job Request' }}
      />
      <HomeStackNav.Screen
        name="RequestEstimate"
        component={RequestEstimateScreen}
        options={{ title: 'Estimate Details' }}
      />
    </HomeStackNav.Navigator>
  );
}

const JobsStackNav = createStackNavigator();
function JobsStack() {
  return (
    <JobsStackNav.Navigator screenOptions={stackScreenOptions}>
      <JobsStackNav.Screen
        name="PlacedOrders"
        component={PlacedOrdersScreen}
        options={{ title: 'My Job Requests' }}
      />
      <JobsStackNav.Screen
        name="RequestEstimate"
        component={RequestEstimateScreen}
        options={{ title: 'Estimate Details' }}
      />
      <JobsStackNav.Screen
        name="JobRequest"
        component={JobRequestScreen}
        options={{ title: 'New Job Request' }}
      />
    </JobsStackNav.Navigator>
  );
}

const BidsStackNav = createStackNavigator();
function BidsStack() {
  return (
    <BidsStackNav.Navigator screenOptions={stackScreenOptions}>
      <BidsStackNav.Screen
        name="Bids"
        component={BidsScreen}
        options={{ title: 'My Bids' }}
      />
      <BidsStackNav.Screen
        name="BidDetail"
        component={BidDetailScreen}
        options={{ title: 'Bid Details' }}
      />
    </BidsStackNav.Navigator>
  );
}

const CalendarStackNav = createStackNavigator();
function CalendarStack() {
  return (
    <CalendarStackNav.Navigator screenOptions={stackScreenOptions}>
      <CalendarStackNav.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ title: 'Calendar' }}
      />
    </CalendarStackNav.Navigator>
  );
}

const AccountStackNav = createStackNavigator();
function AccountStack() {
  return (
    <AccountStackNav.Navigator screenOptions={stackScreenOptions}>
      <AccountStackNav.Screen
        name="Account"
        component={AccountScreen}
        options={{ title: 'My Account' }}
      />
    </AccountStackNav.Navigator>
  );
}

/* ==========================================================================
   BOTTOM TAB BAR — the heart of the new navigation
   ========================================================================== */
const Tabs = createBottomTabNavigator();

function MainTabs() {
  // Live badge counts driven by the global store
  const { jobRequests, bids } = useStore();
  const pendingJobs = jobRequests.filter((j) => j.status === 'pending').length;
  const newBids = bids.filter((b) => b.status === 'submitted').length;

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: '#8E9AAF',
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          position: 'absolute',
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ color, focused, size }) => {
          const iconMap = {
            HomeTab: focused ? 'home' : 'home-outline',
            JobsTab: focused ? 'clipboard' : 'clipboard-outline',
            BidsTab: focused ? 'pricetag' : 'pricetag-outline',
            CalendarTab: focused ? 'calendar' : 'calendar-outline',
            AccountTab: focused ? 'person-circle' : 'person-circle-outline',
          };
          return (
            <Ionicons name={iconMap[route.name]} size={size + 2} color={color} />
          );
        },
      })}
      screenListeners={{
        tabPress: () => {
          if (Platform.OS !== 'web') {
            Haptics.selectionAsync().catch(() => {});
          }
        },
      }}
    >
      <Tabs.Screen name="HomeTab" component={HomeStack} options={{ title: 'Home' }} />
      <Tabs.Screen
        name="JobsTab"
        component={JobsStack}
        options={{
          title: 'Jobs',
          tabBarBadge: pendingJobs > 0 ? pendingJobs : undefined,
          tabBarBadgeStyle: {
            backgroundColor: COLORS.accent,
            color: COLORS.white,
            fontWeight: '700',
          },
        }}
      />
      <Tabs.Screen
        name="BidsTab"
        component={BidsStack}
        options={{
          title: 'Bids',
          tabBarBadge: newBids > 0 ? newBids : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#E67E22',
            color: COLORS.white,
            fontWeight: '700',
          },
        }}
      />
      <Tabs.Screen
        name="CalendarTab"
        component={CalendarStack}
        options={{ title: 'Calendar' }}
      />
      <Tabs.Screen
        name="AccountTab"
        component={AccountStack}
        options={{ title: 'Account' }}
      />
    </Tabs.Navigator>
  );
}

/* ==========================================================================
   ROOT STACK — wraps MainTabs (allows future global modals)
   ========================================================================== */
const RootStackNav = createStackNavigator();

export default function App() {
  const {
    isAuthenticated,
    isLoading,
    initAuth,
    registerPushToken,
    refreshAll,
  } = useStore();
  const appState = useRef(AppState.currentState);
  const notificationListener = useRef();
  const responseListener = useRef();

  // 1) initial auth bootstrap
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // 2) push notifications — register token + listen for arrivals/taps
  useEffect(() => {
    if (!isAuthenticated) return;

    registerPushToken?.().catch(() => {});

    notificationListener.current = Notifications.addNotificationReceivedListener(
      () => {
        // any incoming push → refetch so the UI is in sync with the backend
        refreshAll?.().catch(() => {});
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        // optionally route based on payload (e.g. response.notification.request.content.data)
        refreshAll?.().catch(() => {});
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isAuthenticated]);

  // 3) AppState foreground refresh (mirrors React Query focus behavior)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        focusManager.setFocused(true);
        if (isAuthenticated) refreshAll?.().catch(() => {});
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [isAuthenticated, refreshAll]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: COLORS.primary,
        }}
      >
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <ActivityIndicator size="large" color={COLORS.white} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
          <NavigationContainer theme={NavTheme} linking={linking}>
            {isAuthenticated ? (
              <RootStackNav.Navigator screenOptions={{ headerShown: false }}>
                <RootStackNav.Screen name="MainTabs" component={MainTabs} />
              </RootStackNav.Navigator>
            ) : (
              <AuthStack />
            )}
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

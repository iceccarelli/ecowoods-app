import React, { useState } from 'react';
import { View, Text, Image, Button, Linking, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native';
import styles from './styles'; 
import { FontAwesome as Icon } from '@expo/vector-icons';
import CalendarScreen from './CalendarScreen';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './LoginScreen';
import Settings from './Settings';
import AccountInformationScreen from './AccountInformationScreen';
import PaymentOptionsScreen from './PaymentOptionsScreen';
import AddPaymentMethodScreen from './AddPaymentMethodScreen';
import ShippingAddressScreen from './ShippingAddressScreen';
import NotificationPreferencesScreen from './NotificationPreferencesScreen';
import PrivacyOptionsScreen from './PrivacyOptionsScreen';
import BuzzScreen from './BuzzScreen';
import RegisterScreen from './RegisterScreen';
import RenovationsScreen from './RenovationsScreen';
import RequestEstimateScreen from './RequestEstimateScreen';
import JobRequestScreen from './JobRequestScreen'
import PlacedOrdersScreen from './PlacedOrdersScreen'
import Bidersladen from './Bidersladen'
import BidTableLadenScreen from './BidTableLadenScreen'


const iPhoneModels = [];
const AndroidModels = [];
const textInputScrolldownSearch = [
            'hardwood floor installation Toronto',
            'Home',
            'Renovations',
            'Installations',
            'About',
            'Services',
            'Testimonials',
            'Portfolio',
            'Job Request',
            'Blog',
            'Contact',
            'Calendar',
          ];

const HomeScreen: React.FC = ({ navigation, route }) => {


  const orderDetails = route.params?.orderDetails || "";
  const [searchTerm, setSearchTerm] = useState("");
  const repairOptionsCount = 10;
  const [buttonPressCounts, setButtonPressCounts] = useState(Array(repairOptionsCount).fill(0));
  const [isMiddle, setIsMiddle] = useState(true);
  const [details, setDetails] = useState("");
  const [showState, setShowState] = useState({
    showIphoneDetails: false,
    showAndroidDetails: false,
    showHomeButtons: false,
    showBuildingButtons: false,
    showToolButtons: false,
    showAircraftButtons: false,
    showTrainButtons: false,
    showPhoneScreenButtons: false,
    showCarsScreenButtons: false,
    showRepairButtons: false,
    showTrucksDetails: false,
    showCarsDetails: false,
  });

  const [showMenu, setShowMenu] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('Home'); 

  const navigateTo = (screen) => {
    console.log(`Navigating to ${screen}`);
    navigation.navigate(screen); // use the navigate function of navigation prop
};

  if (currentScreen === 'Calendar') {
    return <CalendarScreen />;
  }
  const filteredResults = () => {
  if (!searchTerm) return textInputScrolldownSearch; // Show all results if searchTerm is empty
  return textInputScrolldownSearch.filter(item => 
    item.toLowerCase().includes(searchTerm.toLowerCase())
  );
}


  

  return (
    
    
    <ScrollView>
    <View style={{ padding: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Image
          style={{ width: 300, height: 40, resizeMode: 'contain' }}
          source={{ uri: "http://d14ty28lkqz1hw.cloudfront.net/data/org/15286/theme/21869/img/logo.png" }}
        />
      </View>


      <View style={styles.searchBar}>
    <Icon name="search" size={24} color="#000" />
    <TextInput
      placeholder="Need help with..."
      onChangeText={text => setSearchTerm(text)}
      value={searchTerm}
      style={styles.textinputStyle}
    />
    <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.menuButton}>
      <Icon name="bars" size={24} color="#000" />
    </TouchableOpacity>
</View>


      {showMenu && (
        <View style={styles.dropdown}>
          {textInputScrolldownSearch.map((menuItem) => (
            <TouchableOpacity key={menuItem} onPress={() => navigateTo(menuItem)}>
              <Text style={styles.menuItem}>{menuItem}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={{ fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
        Ecowoods Hardwood
      </Text>
      <Text style={{ textAlign: 'center' }}>Hardwood Flooring Company in Greater Toronto Area</Text>
      <Text style={{ marginVertical: 10 }}>
        Our flooring company, Ecowoods Hardwood, offers you the highest quality of finishing for Hardwood Floors and Hardwood Stairs across the Greater Toronto Area. At EcoWoods Inc., our philosophy is simple; to be the best we can be in servicing your flooring needs. We believe that our customers come first; it is not just a cliché but a commitment we make to all our past and future customers.
      </Text>
      <Button
        title="Contact Us"
        onPress={() => Linking.openURL('http://www.ecowoodshardwood.com/pages/hardwood-floor-installation-and-refinishing-toronto-etobicoke-hamilton')}
      />
      
      <Text style={{ fontSize: 12, marginTop: 10 }}>Phone: (647)244-5156</Text>
      <Text style={{ fontSize: 12 }}>Email: ecowoodshardwood@yahoo.com</Text>
      <Text style={{ fontSize: 12 }}>Address: 32 Norfield Crescent, Etobicoke, Ontario, Canada, M9W 1X6</Text>
      
    </View>
    
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 10 }}>
    <Text>Your order of {orderDetails} is being processed.</Text>
</View>


    

<View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 10 }}>
    <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('SettingsScreen')}>
        <Icon name="cog" size={40} color="#232F3E" />
    </TouchableOpacity>
    <TouchableOpacity style={styles.footerButton} onPress={() => navigation.goBack()}>
        <Icon name="arrow-left" size={40} color="#232F3E" />
    </TouchableOpacity>
</View>

    
    </ScrollView>
    
  );
};

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Renovations" component={RenovationsScreen} />
        <Stack.Screen name="Calendar" component={CalendarScreen} />
        <Stack.Screen name="SettingsScreen" component={Settings} />
        <Stack.Screen name="RequestEstimate" component={RequestEstimateScreen} initialParams={{ pressedButtons: [] , userEnteredDetails:"" }} />
        <Stack.Screen name="Placed Orders" component={PlacedOrdersScreen} initialParams={{ pressedButtons: [] , userEnteredDetails:"" }} />
        <Stack.Screen name="Bidersladen" component={Bidersladen} initialParams={{ pressedButtons: [] , userEnteredDetails:"" }} />
        <Stack.Screen name="BidTableLadenScreen" component={BidTableLadenScreen} initialParams={{ pressedButtons: [] , userEnteredDetails:"" }} />
        <Stack.Screen name="Job Request" component={JobRequestScreen} />
        <Stack.Screen name="AccountInformationScreen" component={AccountInformationScreen} />
        <Stack.Screen name="PaymentOptionsScreen" component={PaymentOptionsScreen} /> 
        <Stack.Screen name="AddPaymentMethod" component={AddPaymentMethodScreen} />
        <Stack.Screen name="ShippingAddressScreen" component={ShippingAddressScreen} />
<Stack.Screen name="NotificationPreferencesScreen" component={NotificationPreferencesScreen} />
<Stack.Screen name="PrivacyOptionsScreen" component={PrivacyOptionsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}


import { useState } from 'react';
import { View, Text, Button, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Platform, Image  } from 'react-native';
import { FontAwesome as Icon } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import { SHA256 } from 'crypto-js';

const JobRequestScreen = ({ route, navigation }) => {
  const navigateToHome = () => {
        navigation.reset({
            index: 0,
            routes: [{name: 'Home'}],
        });
        };
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [size, setSize] = useState(null);
  
const [woodType, setWoodType] = useState(null);
const [width, setWidth] = useState("");
const [thickness, setThickness] = useState("");
const [color, setColor] = useState(null);
const [propertyType, setPropertyType] = useState(null);
const [homeLevels, setHomeLevels] = useState(null);
const [demolitionRequired, setDemolitionRequired] = useState(null);
const [subfloorType, setSubfloorType] = useState(null);
const [timeframe, setTimeframe] = useState(null);
  const [buttonPressCounts, setButtonPressCounts] = useState(Array(10).fill(0));
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const generateUserID = () => {
    // Combine all the information to create a unique string
    const infoString = `${buttonPressCounts.join('-')}${details}${email}`;
    return SHA256(infoString).toString();
};
const HARDWOOD_TYPES = [
  "Ash",
  "Bamboo",
  "Beech",
  "Birch",
  "Cherry",
  "Cumaru (Brazilian Teak)",
  "Hickory",
  "Ipe",
  "Jatoba (Brazilian Cherry)",
  "Mahogany",
  "Maple",
  "Oak",
  "Pecan",
  "Pine",
  "Red Oak",
  "Sapele",
  "Teak",
  "Tigerwood",
  "Walnut",
  "White Oak"
];

HARDWOOD_TYPES.sort();

  const repairOptions = [
    'Hardwood Installation',
    'Hardwood Installation and finishing',
    'Hardwood Stain Colour Matching',
    'Staircase finishing / Refinishing',
    'Hardwood Repair',
    'Vinyl / Laminate Instalation',
    '....',
    '....',
    '....',
    '....',
  ];
  const SIZES = Array.from({ length: 20 }, (_, i) => `${(i + 1) * 5} sq`);
const COLORS = ['Natural', 'Stain', 'Special'];
const PROPERTY_TYPES = ['Select a residence type','House', 'Apartment', 'Condominium'];
const HOME_LEVELS = ['Basement', '1 Level', '2 Levels', '3 Levels', 'More than 4 Levels'];
const DEMOLITION_OPTIONS = ['Yes', 'No'];
const SUBFLOOR_TYPES = ['Concrete', 'Wood'];
const TIMEFRAMES = ['1-2 weeks', '2-4 weeks', '4-6 weeks', 'More than 6 weeks'];
const createTXTFile = () => {
  const pressedButtons = repairOptions.filter((_, index) => buttonPressCounts[index] > 0);

  // New table structure and components
  const tableBorder = '+-----------------------------+----------------------------------------------------+';
  const header = `| Field                       | Value                                              |\n${tableBorder}`;

  // Add the Ecowood Services header
  const ecowoodHeader = 'Ecowood Services:';

  // Add the Name (assuming details are the name for now), UserID, and Email
  const nameRow = `| Name:                       | ${details.padEnd(50)} |\n`;
  const userID = generateUserID();
  const userIDRow = `| User ID:                    | ${userID.padEnd(50)} |\n`;
  const emailRow = `| Email:                      | ${email.padEnd(50)} |\n`;

  // Construct the Selected Services rows
  const servicesRows = pressedButtons.map((service, idx) => 
    `| ${idx + 1}. Selected Service To-Do | ${service.padEnd(50)} |\n`
  ).join('');

  // Construct the Additional Details row
  const sizeRow = size ? `| Size (sq feet)              | ${size.padEnd(50)} |\n` : '';
  const woodTypeRow = woodType ? `| Hardwood Type               | ${woodType.padEnd(50)} |\n` : '';
  const dimensionsRow = (width && thickness) ? `| Width x Thickness          | ${width} x ${thickness} |\n` : '';
  const colorRow = color ? `| Color Requested             | ${color.padEnd(50)} |\n` : '';
  const propertyTypeRow = propertyType ? `| Property Type              | ${propertyType.padEnd(50)} |\n` : '';
  const homeLevelsRow = (propertyType === 'House' && homeLevels) ? `| Home Levels                 | ${homeLevels.padEnd(50)} |\n` : '';
  const demolitionRow = demolitionRequired ? `| Demolition Required?       | ${demolitionRequired.padEnd(50)} |\n` : '';
  const subfloorRow = subfloorType ? `| Subfloor Type               | ${subfloorType.padEnd(50)} |\n` : '';
  const timeframeRow = timeframe ? `| Timeframe Requested         | ${timeframe.padEnd(50)} |\n` : '';

  let textContent = `
${ecowoodHeader}
${tableBorder}
${nameRow}
${userIDRow}
${emailRow}
${tableBorder}
${header}
${servicesRows}
${sizeRow}
${woodTypeRow}
${dimensionsRow}
${colorRow}
${propertyTypeRow}
${homeLevelsRow}
${demolitionRow}
${subfloorRow}
${timeframeRow}
${tableBorder}
\n\nThank you for choosing Ecowoods Hardwood!
  `;

  if (Platform.OS === 'web') {
    // If on web platform, create a download link for the text content
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    // Create a temporary anchor element
    const a = document.createElement('a');
    a.href = url;
    a.download = 'EcowoodsOrder.txt';
    a.click();

    URL.revokeObjectURL(url);
  } else {
    // For other platforms, write to file
    const filename = `${FileSystem.documentDirectory}EcowoodsOrder.txt`;

    try {
      FileSystem.writeAsStringAsync(filename, textContent, { encoding: FileSystem.EncodingType.UTF8 });
      Alert.alert('Success', 'TXT created at ' + filename);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'An error occurred while creating the TXT.');
    }
  }
};





const goToRequestEstimateScreen = () => {
    const pressedButtons = repairOptions.filter((_, index) => buttonPressCounts[index] > 0);

    navigation.navigate('RequestEstimate', {
      pressedButtons: pressedButtons,
      userEnteredDetails: details,
      email: email,
      size: size,
      woodType: woodType,
      width: width,
      thickness: thickness,
      color: color,
      propertyType: propertyType,
      homeLevels: homeLevels,
      demolitionRequired: demolitionRequired,
      subfloorType: subfloorType,
      timeframe: timeframe
    });
  };




  return (
    <ScrollView style={styles.container}>
   <Image 
        style={styles.logo}
        source={{ uri: "http://d14ty28lkqz1hw.cloudfront.net/data/org/15286/theme/21869/img/logo.png" }}
      />
      
      <Text style={styles.title}>Ecowoods Hardwood</Text>
      <Text style={styles.description}>Select the services you need, and we'll provide an estimate for you.</Text>
      
      <View style={styles.buttonsWrapper}>
        {repairOptions.map((text, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.serviceButton,
              { backgroundColor: buttonPressCounts[index] > 0 ? '#FF5A5F' : '#00A699' }
            ]}
            onPress={() => {
              let newCounts = [...buttonPressCounts];
              newCounts[index] = newCounts[index] ? 0 : 1;
              setButtonPressCounts(newCounts);
            }}
          >
            <Text style={styles.buttonText}>{text}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {
        buttonPressCounts.reduce((a, b) => a + b, 0) > 0 &&
        <Text style={styles.orderText}>
          You have selected {buttonPressCounts.reduce((a, b) => a + b, 0)} services
        </Text>
      }

      {repairOptions.map((text, index) => (
        buttonPressCounts[index] > 0 && (
          <Text key={index} style={styles.selectedServiceText}>
            {index + 1}. {text}
          </Text>
        )
      ))}
     {showValidationErrors && !details && <Text style={styles.errorText}>Data is required</Text>}

<Text>Size:</Text>
{showValidationErrors && !size && <Text style={styles.errorText}>Data is required</Text>}
<Picker
  selectedValue={size}
  onValueChange={(itemValue) => setSize(itemValue)}
  style={{ height: 50, width: '100%', marginBottom: 10 }}
>
  <Picker.Item label="Select Size..." value="default" />
  {[...Array(18)].map((_, i) => (
    <Picker.Item key={i} label={`${15 + (i * 5)} sq feet`} value={`${15 + (i * 5)} sq feet`} />
  ))}
</Picker>

<Text>Hardwood Type:</Text>
{showValidationErrors && !woodType && <Text style={styles.errorText}>Data is required</Text>}
<Picker
  selectedValue={woodType}
  onValueChange={(itemValue) => setWoodType(itemValue)}
  style={{ height: 50, width: '100%', marginBottom: 10 }}
>
  <Picker.Item label="Select Hardwood Type..." value="default" />
  {HARDWOOD_TYPES.map((type) => (
    <Picker.Item key={type} label={type} value={type} />
  ))}
</Picker>

<Text>Thickness (Width) of hardwood floor:</Text>
<Picker
  selectedValue={thickness}
  onValueChange={(itemValue) => setThickness(itemValue)}
  style={styles.picker}
>
  <Picker.Item label="Select thickness..." value="default" />
  <Picker.Item label="10mm" value="10" />
     <Picker.Item label="12mm" value="12" />
        <Picker.Item label="15mm" value="15" />
        <Picker.Item label="18mm" value="18" />
        <Picker.Item label="20mm" value="20" />
  {/* ... other items ... */}
</Picker>

<Text>COLORS:</Text>
<Picker
  selectedValue={color}
  onValueChange={(itemValue) => setColor(itemValue)}
  style={styles.picker}
>
  <Picker.Item label="Select Color..." value="default" />
  {COLORS.map((c) => <Picker.Item key={c} label={c} value={c} />)}
</Picker>

<Text>PROPERTY_TYPES:</Text>
<Picker
  selectedValue={propertyType}
  onValueChange={(itemValue) => setPropertyType(itemValue)}
  style={styles.picker}
>
  <Picker.Item label="Select Property Type..." value="default" />
  {PROPERTY_TYPES.map((type) => <Picker.Item key={type} label={type} value={type} />)}
</Picker>

<Text>Demolition Required:</Text>
<Picker
  selectedValue={demolitionRequired}
  onValueChange={(itemValue) => setDemolitionRequired(itemValue)}
  style={styles.picker}
>
  <Picker.Item label="Select Option..." value="default" />
  {DEMOLITION_OPTIONS.map((option) => <Picker.Item key={option} label={option} value={option} />)}
</Picker>

<Text>Subfloor Type:</Text>
<Picker
  selectedValue={subfloorType}
  onValueChange={(itemValue) => setSubfloorType(itemValue)}
  style={styles.picker}
>
  <Picker.Item label="Select Subfloor Type..." value="default" />
  {SUBFLOOR_TYPES.map((type) => <Picker.Item key={type} label={type} value={type} />)}
</Picker>

<Text>Timeframe Required:</Text>
<Picker
  selectedValue={timeframe}
  onValueChange={(itemValue) => setTimeframe(itemValue)}
  style={styles.picker}
>
  <Picker.Item label="Select Timeframe..." value="default" />
  {TIMEFRAMES.map((time) => <Picker.Item key={time} label={time} value={time} />)}
</Picker>

 <TouchableOpacity style={styles.homeButton} onPress={navigateToHome}>
                <Icon name="home" size={24} color="#FFF" />
                <Text style={styles.homeButtonText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeButton} onPress={goToRequestEstimateScreen}>
                <Icon name="wrench" size={24} color="#FFF" />
                <Text style={styles.homeButtonText}>Get an Estimate</Text>
            </TouchableOpacity>

      
      <TouchableOpacity onPress={createTXTFile}>
    <Text style={styles.hyperlinkText}>Save as TXT</Text>
</TouchableOpacity>

      <View style={styles.footer}>
    <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('SettingsScreen')}>
        <Icon name="cog" size={40} color="#232F3E" />
    </TouchableOpacity>
    <TouchableOpacity style={styles.footerButton} onPress={() => navigation.goBack()}>
        <Icon name="arrow-left" size={40} color="#232F3E" />
    </TouchableOpacity>
</View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2023 Ecowoods Hardwood. All Rights Reserved.</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
 container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#F6F6F6',
        alignItems: 'center'
    },
  logo: {
    width: '100%',
    height: 60,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#777',
    marginBottom: 20,
  },
  buttonsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  serviceButton: {
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    width: '48%',  // two buttons in a row with a little space in between
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
  },
  picker: {
    height: 50,
    width: '100%',
    marginBottom: 10,
    backgroundColor: '#FFF',
    borderRadius: 5,
    borderColor: '#E0E0E0',
    borderWidth: 1,
  },
  footer: {
        flexDirection: 'row',   // This ensures children are aligned in a row.
        justifyContent: 'space-between', // This ensures maximum space between the two buttons.
        alignItems: 'center',  // In case your icons are of different sizes, they will be vertically centered.
        padding: 10
    },
    footerButton: {
        flex: 0.48,  // This gives each button almost half the space of the parent, 0.48 ensures a tiny space between them.
        alignItems: 'center'   // Centers the icon in case the touchable opacity doesn't stretch the full width.
    },
  footerText: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
  },
  
  
  orderText: {
    marginBottom: 15,
    fontWeight: 'bold'
  },
  selectedServiceText: {
    padding: 5,
    textAlign: 'left',
    color: 'black',
    fontWeight: 'bold',
    marginBottom: 5
  },
  textarea: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 20
  },
  
  estimateButton: {
    backgroundColor: '#FF5A5F',
    padding: 12,
    borderRadius: 5,
    marginBottom: 20
  },
  
  footerButton: {
    padding: 10
  },
  hyperlinkText: {
        color: 'blue',
        textAlign: 'center',
        textDecorationLine: 'underline'
    },
errorText: {
        color: 'red',
        fontSize: 14,
        marginBottom: 5
    },
   homeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2980B9', // more vibrant blue
        padding: 15,
        borderRadius: 35,
        marginTop: 20,
    },
    homeButtonText: {
        color: '#FFF',
        marginLeft: 15,
        fontSize: 20,
        fontWeight: 'bold'
    },
});

export default JobRequestScreen;

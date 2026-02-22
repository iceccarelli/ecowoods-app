import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Animated, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome as Icon } from '@expo/vector-icons';



const RequestEstimateScreen: React.FC = ({ route}) => {
    const navigateToHome = () => {
        navigation.reset({
            index: 0,
            routes: [{name: 'Home'}],
        });
        };
    const navigation = useNavigation();

   const {
        pressedButtons, 
        userEnteredDetails,
        email: passedEmail,
        size,
        woodType,
        width,
        thickness,
        color,
        propertyType,
        homeLevels,
        demolitionRequired,
        subfloorType,
        timeframe
    } = route.params;
    const [details, setDetails] = useState(userEnteredDetails || "");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const shimmerAnimation = useRef(new Animated.Value(0)).current;
    const widthAnimation = useRef(new Animated.Value(0)).current;  // New animated value

    useEffect(() => {
        if (isLoading) {
            // Animate shimmer effect
            const shimmerEffect = Animated.loop(
              Animated.sequence([
                Animated.timing(shimmerAnimation, {
                    toValue: 2,
                    duration: 1500,
                    useNativeDriver: true
                }),
                Animated.timing(shimmerAnimation, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true
                }),
                Animated.timing(shimmerAnimation, {
                    toValue: 0,
                    duration: 2000,
                    useNativeDriver: true
                })
                ])
            );

            // Animate width
            const widthEffect = Animated.loop(
                Animated.sequence([
                    Animated.timing(widthAnimation, {
                        toValue: 1,
                        duration: 2500,
                        useNativeDriver: false
                    }),
                    Animated.timing(widthAnimation, {
                        toValue: 0,
                        duration: 2500,
                        useNativeDriver: false
                    })
                ])
            );

            // Start both animations in parallel
            Animated.parallel([shimmerEffect, widthEffect]).start();
        }
    }, [isLoading]);
    const handleSubmit = () => {
    setIsLoading(true);

    setTimeout(() => {
        console.log({ name, email, phone, details });
        setName("");
        setEmail("");
        setPhone("");
        setDetails("");
        setIsLoading(false);

        navigation.navigate('Placed Orders', {
            orderDetails: details,
            pressedButtons: pressedButtons,
            // If radius is necessary, make sure to define it.
            email: passedEmail,
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
    }, 7000);
};


    if (isLoading) {
        const shimmerColor = shimmerAnimation.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: ['#e1e1e1', '#f2f2f2', '#e1e1e1']
        });

        const animatedWidth = widthAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: ['100%', '30%']
        });

        return (
            <View style={styles.loaderContainer}>
                {[...Array(3)].map((_, index) => (
                    <Animated.View key={index} style={{ ...styles.skeleton, backgroundColor: shimmerColor, width: animatedWidth, marginTop: index !== 0 ? 10 : 0 }} />
                ))}
                <Image style={styles.logo} source={{ uri: "http://d14ty28lkqz1hw.cloudfront.net/data/org/15286/theme/21869/img/logo.png" }} />
                <Text style={styles.title}>Your request with us is being processed</Text>
                <View style={styles.detailsContainer}>
                    <Text style={styles.subtitle}>You requested:</Text>
                    {pressedButtons.map((button, index) => (<Text key={index}>{index + 1}. {button}</Text>))}
                    <Text style={styles.title}>To be Processed at Ecowoods:</Text>
                {pressedButtons.map((button, index) => (
                <Text key={index}> {index + 1}. {button}</Text>))}
                
                <Text style={{ marginTop: 10, fontSize: 16 }}>Additional Details:</Text>
                <Text>{details}</Text>  {/* Show the user-entered details */}
                
                {/* Display other retrieved details */}
                <Text>Email: {passedEmail}</Text>
                <Text>Size: {size}</Text>
                <Text>Wood Type: {woodType}</Text>
                <Text>Width: {width}</Text>
                <Text>Thickness: {thickness}</Text>
                <Text>Color: {color}</Text>
                <Text>Property Type: {propertyType}</Text>
                <Text>Home Levels: {homeLevels}</Text>
                <Text>Demolition Required: {demolitionRequired}</Text>
                <Text>Subfloor Type: {subfloorType}</Text>
                <Text>Timeframe: {timeframe}</Text>
                    <Text style={styles.subtitle}>With these Additional Details:</Text>
                    <Text>{details}</Text>
                </View>
                <ActivityIndicator size="large" color="#0000ff" style={styles.activityIndicator} />
            </View>
        );
    }

     return (
        <View style={styles.container}>
            <View style={styles.buzzContainer}>
                <Text style={styles.title}>To be Processed at Ecowoods:</Text>
                {pressedButtons.map((button, index) => (
                <Text key={index}> {index + 1}. {button}</Text>))}
                
                <Text style={{ marginTop: 10, fontSize: 16 }}>Additional Details:</Text>
                <Text>{details}</Text>  {/* Show the user-entered details */}
                
                {/* Display other retrieved details */}
                <Text>Email: {passedEmail}</Text>
                <Text>Size: {size}</Text>
                <Text>Wood Type: {woodType}</Text>
                <Text>Width: {width}</Text>
                <Text>Thickness: {thickness}</Text>
                <Text>Color: {color}</Text>
                <Text>Property Type: {propertyType}</Text>
                <Text>Home Levels: {homeLevels}</Text>
                <Text>Demolition Required: {demolitionRequired}</Text>
                <Text>Subfloor Type: {subfloorType}</Text>
                <Text>Timeframe: {timeframe}</Text>

                {/* Google Map Placeholder */}
                
                <View style={styles.mapContainer}>
                    <Image 
                        style={styles.map}
                        source={{ uri: 'https://maps.googleapis.com/maps/api/staticmap?center=47.6062,-122.3321&zoom=15&size=400x400&key=YOUR_GOOGLE_MAPS_API_KEY' }}
                    />
                    <Text style={styles.placeholderText}>Google Maps Placeholder</Text>
                </View>
            </View>

            <Text style={styles.title}>If you are ready to Ecowood your floor, press on your Submit Request Button:</Text>
            <TextInput placeholder="Your Name" style={styles.input} value={name} onChangeText={setName} />
            <TextInput placeholder="Email Address" style={styles.input} value={email} onChangeText={setEmail} />
            <TextInput placeholder="Phone Number" style={styles.input} value={phone} onChangeText={setPhone} />
            <TextInput placeholder="Additional Details" style={styles.textarea} multiline value={details} onChangeText={setDetails} />
            <Button title="Submit my Eco Request" onPress={handleSubmit} />
             <TouchableOpacity style={styles.homeButton} onPress={navigateToHome}>
                <Icon name="home" size={24} color="#FFF" />
                <Text style={styles.homeButtonText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeButton} onPress={handleSubmit}>
                <Icon name="wrench" size={24} color="#FFF" />
                <Text style={styles.homeButtonText}>Get an Estimate</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#F6F6F6'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20
    },
    subtitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginVertical: 10
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 10,
        marginBottom: 15,
        fontSize: 16
    },
    textarea: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 10,
        marginBottom: 15,
        height: 100,
        fontSize: 16
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    skeleton: {
        height: 20,
        borderRadius: 5,
        marginBottom: 10
    },
    logo: {
        width: '100%',
        height: 50,
        resizeMode: 'contain',
        marginVertical: 20
    },
    detailsContainer: {
        alignItems: 'flex-start',
        padding: 20
    },
    activityIndicator: {
        marginTop: 20
    },
    buzzContainer: {
        flex: 1,
        padding: 20,
        marginBottom: 20,
        borderRadius: 5,
        backgroundColor: '#FFFFFF', // White background
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3
    },
    mapContainer: {
        marginTop: 15,
        alignItems: 'center',
        justifyContent: 'center',
        height: 400,
        borderRadius: 10,
        overflow: 'hidden'  // Clip children
    },
    map: {
        width: '100%',
        height: '100%'
    },
    placeholderText: {
        position: 'absolute',
        zIndex: 1,
        color: 'grey'
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

export default RequestEstimateScreen;
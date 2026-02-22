import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const PRIMARY_COLOR = '#232F3E';
const SECONDARY_COLOR = '#999';
const BACKGROUND_COLOR = '#f4f4f4';
const HIGHLIGHT_COLOR = 'green';
const BORDER_COLOR = '#d3d3d3';
const LIGHT_BORDER_COLOR = '#E0E0E0';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: BACKGROUND_COLOR,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginBottom: 10,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: SECONDARY_COLOR,
    marginTop: 10,
  },
  input: {
    width: '100%',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 5,
    marginBottom: 15,
    fontSize: 16,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
    color: PRIMARY_COLOR,
  },
  mapContainer: {
    flex: 1,
    width: width,
    height: height / 3,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  button: {
    width: '100%',
    padding: 15,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button_1: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: PRIMARY_COLOR,
    borderColor: HIGHLIGHT_COLOR,
    borderWidth: 1,
    marginTop: 10,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  iconBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: PRIMARY_COLOR,
    padding: 10,
    marginTop: 10,
  },
  scrollContent: {
    paddingHorizontal: 20, 
    alignItems: 'center',
  },
  iconWithLabel: {
    flexDirection: 'column',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  iconLabel: {
    marginTop: 5,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
  settingsList: {
    flex: 1,
    marginTop: 10,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomColor: LIGHT_BORDER_COLOR,
    borderBottomWidth: 1,
  },
  settingText: {
    fontSize: 16,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginTop: 10,
    backgroundColor: BACKGROUND_COLOR,
  },
  searchInput: {
    flex: 1,
    padding: 10,
    marginHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 4,
    elevation: 2,
  },
  bottomNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    padding: 10,
    borderTopWidth: 1,
    borderColor: LIGHT_BORDER_COLOR,
    backgroundColor: BACKGROUND_COLOR,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: LIGHT_BORDER_COLOR,
  },
  footerButton: {
    padding: 10,
  },
  registerLink: {
    marginTop: 15,
    textAlign: 'center',
    color: PRIMARY_COLOR,
    textDecorationLine: 'underline',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LIGHT_BORDER_COLOR,
    backgroundColor: '#fff'
  },
  textarea: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    height: 100,
  },
  textinputStyle: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: 16,
    borderColor: 'gray',
    borderWidth: 1,
    padding: 5,
    color: '#000',
  },
  menuButton: {
    padding: 8
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
    width: '80%',
    alignSelf: 'center',
  },
  menuItem: {
    fontSize: 16,
    paddingVertical: 10,
    borderBottomColor: LIGHT_BORDER_COLOR,
    borderBottomWidth: 0.5,
    color: PRIMARY_COLOR,
  },
  day: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  item: {
    backgroundColor: 'lightgray',
    flex: 1,
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
    marginTop: 10,
  },
});

export default styles;

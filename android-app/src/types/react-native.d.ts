declare module 'react-native' {
  export const StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => T;
  };
  export const View: any;
  export const Text: any;
  export const TouchableOpacity: any;
  export const TextInput: any;
  export const ScrollView: any;
  export const FlatList: any;
  export const Image: any;
  export const ActivityIndicator: any;
  export const Modal: any;
  export const SafeAreaView: any;
  export const StatusBar: any;
  export const AppRegistry: {
    registerComponent: (name: string, component: () => any) => void;
  };
  export const AppState: {
    addEventListener: (type: 'change', handler: (state: string) => void) => {
      remove: () => void;
    };
  };
  export type AppStateStatus = 'active' | 'background' | 'inactive';
  export type GestureResponderEvent = any;
  export type PanResponderGestureState = any;
  export const PanResponder: {
    create: (config: any) => any;
  };
}

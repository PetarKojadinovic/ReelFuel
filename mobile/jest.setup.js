// AsyncStorage u testovima čuva podatke u memoriji (zvanični mock paketa)
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

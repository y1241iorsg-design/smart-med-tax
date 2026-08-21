// フロントエンドが呼び出すAPIの入り口。
// NEXT_PUBLIC_MOCK_MODE=1 のとき(GitHub Pages静的公開用ビルド)は、
// バックエンド(FastAPI)を呼ばずブラウザのlocalStorageで動く lib/mock/api.ts を使う。
// それ以外(通常のNext.js dev/Vercel等)は lib/httpApi.ts が実際にFastAPIを呼ぶ。
export * from "./apiTypes";

import * as httpApi from "./httpApi";
import * as mockApi from "./mock/api";

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK_MODE === "1";
const backend: typeof httpApi = IS_MOCK ? mockApi : httpApi;

export const lookupJan: typeof httpApi.lookupJan = backend.lookupJan;
export const findProductsByName: typeof httpApi.findProductsByName = backend.findProductsByName;
export const addPurchase: typeof httpApi.addPurchase = backend.addPurchase;
export const getPurchases: typeof httpApi.getPurchases = backend.getPurchases;
export const getTaxSummary: typeof httpApi.getTaxSummary = backend.getTaxSummary;
export const downloadTaxExport: typeof httpApi.downloadTaxExport = backend.downloadTaxExport;
export const getInventory: typeof httpApi.getInventory = backend.getInventory;
export const uploadReceipt: typeof httpApi.uploadReceipt = backend.uploadReceipt;
export const sendChatTurn: typeof httpApi.sendChatTurn = backend.sendChatTurn;
export const searchProducts: typeof httpApi.searchProducts = backend.searchProducts;
export const getProductVendors: typeof httpApi.getProductVendors = backend.getProductVendors;
export const getPriceCompare: typeof httpApi.getPriceCompare = backend.getPriceCompare;
export const getNearbyPharmacies: typeof httpApi.getNearbyPharmacies = backend.getNearbyPharmacies;
export const checkInteractions: typeof httpApi.checkInteractions = backend.checkInteractions;
export const getFamily: typeof httpApi.getFamily = backend.getFamily;
export const getConditionOptions: typeof httpApi.getConditionOptions = backend.getConditionOptions;
export const getRxCatalog: typeof httpApi.getRxCatalog = backend.getRxCatalog;
export const getPrescriptions: typeof httpApi.getPrescriptions = backend.getPrescriptions;
export const createPrescription: typeof httpApi.createPrescription = backend.createPrescription;
export const deletePrescription: typeof httpApi.deletePrescription = backend.deletePrescription;
export const createFamilyMember: typeof httpApi.createFamilyMember = backend.createFamilyMember;
export const updateFamilyMember: typeof httpApi.updateFamilyMember = backend.updateFamilyMember;
export const deleteFamilyMember: typeof httpApi.deleteFamilyMember = backend.deleteFamilyMember;
export const updatePurchase: typeof httpApi.updatePurchase = backend.updatePurchase;
export const deletePurchase: typeof httpApi.deletePurchase = backend.deletePurchase;
export const submitFollowUp: typeof httpApi.submitFollowUp = backend.submitFollowUp;
export const getExperts: typeof httpApi.getExperts = backend.getExperts;
export const getExpertSlots: typeof httpApi.getExpertSlots = backend.getExpertSlots;
export const getBookings: typeof httpApi.getBookings = backend.getBookings;
export const createBooking: typeof httpApi.createBooking = backend.createBooking;

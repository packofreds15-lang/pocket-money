// Sends every /api/... request to the Pocket Money API (see server/api.js).
import { handleApi } from "../../server/api.js";

export const onRequest = (context) => handleApi(context.request, context.env, context);

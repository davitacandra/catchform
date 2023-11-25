import Fastify, { FastifyInstance } from 'fastify'
import axios, { AxiosError } from 'axios'
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

const PORT = process.env.PORT! || 3000
const fastify = Fastify({ logger: true })

async function authenticateAndGetToken(fastify: FastifyInstance): Promise<string> {
  // Ensure all required environment variables are present
  if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.OAUTH_URL || !process.env.USERNAME || !process.env.PASSWORD) {
    fastify.log.error('Missing one or more required environment variables');
    throw new Error('Missing one or more required environment variables for authentication');
  }

  const data = {
    grant_type: 'password',
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    username: process.env.USERNAME,
    password: process.env.PASSWORD
  }

  try {
    const response = await axios.post(process.env.OAUTH_URL, new URLSearchParams(data), {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data.access_token;
  } catch (error) {
    throw error;
  }
}

interface googleFormResponse {
  'Nama Lengkap': string
  'Nama Perusahaan / Organisasi': string
  'Nomor Telepon': string
  'Rencana Berlangganan Google Workspace Untuk Berapa User ?': string
  '': string | undefined
}

fastify.post<{ Body: googleFormResponse }>('/submit', async (request, reply) => {
  // Assume googleFormResponse is the type for your Google Form response
  const googleFormResponse = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;

  try {
    // Authenticate and get a new token
    const accessToken = await authenticateAndGetToken(fastify);

    // Map the Google form response to the Nusaprospect fields
    const nusaprospectData = {
      account_industry_list_id: null,
      city: null,
      company: googleFormResponse['Nama Perusahaan / Organisasi'] || null,
      country: null,
      custom_attributes: [{list_id: 37, value: "Google Form"}, {list_id: 31, value: null}],
      description: null,
      district: null,
      email: null,
      group_id: [],
      latitude: null,
      lead_source_id: 6,
      longitude: null,
      name: googleFormResponse['Nama Lengkap'],
      number_of_employees: googleFormResponse['Rencana Berlangganan Google Workspace Untuk Berapa User ?'],
      phones: googleFormResponse['Nomor Telepon'] ? [`+${googleFormResponse['Nomor Telepon']}`] : [],
      product_services: [],
      province: null,
      reseller_id: null,
      salutation_id: 36,
      street: null,
      street_detail: null,
      sub_district: null,
      title: null,
      website: null,
      zip_code: null
    }

    const host = "https://nusanet.api.dev.bis.nusawork.com"; // Replace with your actual host URL

    // Send the data to Nusaprospect using the new token
    const response = await axios.post(`${host}/prospects/api/shark-tanks`, nusaprospectData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`, // Use the access token from the login
        'Content-Type': 'application/json'
      }
    });

    // Send the response from Nusaprospect back to the client
    reply.send(response.data);
  } catch (error) {
    const axiosError = error as AxiosError; // Type assertion here

    if (axios.isAxiosError(axiosError) && axiosError.response) {
      // Handle Axios error
      fastify.log.error('Axios error response:', axiosError.response);
      reply.code(axiosError.response.status).send(axiosError.response.data);
    } else {
      // Handle generic error
      fastify.log.error('Unexpected error:', error);
      reply.code(500).send('An unexpected error occurred');
    }
  }
})

fastify.listen({ port: +PORT, host: '0.0.0.0' }, (err) => {
  if (err) throw err
})
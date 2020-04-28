const express = require('express');
const db = require('./db');

const port = process.env.PORT || 9000;
const app = express();

const fs = require('fs')
const typeDefs = fs.readFileSync('./schema.graphql',{encoding:'utf-8'})
const resolvers = require('./resolvers')

const  {ApolloServer} = require('apollo-server-express')
const server = new ApolloServer({typeDefs, resolvers});
server.applyMiddleware({app});

app.listen(
   port, () => console.info(
      `Server ready at http://localhost:${port}${server.graphqlPath}`
   )
);
const AWS = require("aws-sdk");
const { graphql } = require("graphql");
const {
  ApolloServer,
  gql,
  makeExecutableSchema,
} = require("apollo-server-lambda");

AWS.config.logger = console;

const GSI = {
  ObjType: "objType-index",
  ObjKeyAndObjType: "objKey-objType-index",
  ParentKeyAndObjType: "parentKey-objType-index",
};

const typeDefs = gql`
  type User {
    id: String!
    name: String!
  }

  type Product {
    id: String!
    name: String!
    price: String!
  }

  type Order {
    id: String!
    customerName: String!
    deliveryAddress: String!
    product: Product!
    quantity: Int!
  }

  type Query {
    getUserById(id: String!): User
    getUsers: [User]
  }
`;

const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;
const dynamoDbClient = new AWS.DynamoDB.DocumentClient();

const getObjectsByObjType = async ({ objType }) => {
  const queryInput = {
    TableName: DYNAMODB_TABLE_NAME,
    IndexName: GSI.ObjType,
    KeyConditionExpression: `objType = :objtype`,
    ExpressionAttributeValues: {
      ":objtype": objType,
    },
  };
  const itemResults = [];
  let pageResults = await dynamoDbClient.query(queryInput).promise();

  itemResults.push(...pageResults.Items);

  while (pageResults.$response.hasNextPage()) {
    pageResults = await pageResults.$response.nextPage().promise();

    itemResults.push(...pageResults.Items);
  }
  return itemResults;
};

const getObjectById = async ({ id }) => {
  const queryInput = {
    TableName: DYNAMODB_TABLE_NAME,
    KeyConditionExpression: `id = :id and objType = :objtype`,
    ExpressionAttributeValues: {
      ":id": id,
      ":objtype": "USER",
    },
  };
  let results = await dynamoDbClient.query(queryInput).promise();

  if (results?.Items?.[0]) {
    return results?.Items[0];
  } else {
    throw new Error("Could not find object by id");
  }
};

const resolvers = {
  Query: {
    getUsers: async () => {
      try {
        return await getObjectsByObjType({ objType: "USER" });
      } catch (error) {
        console.error(error);
        throw new Error("Could not retreive users");
      }
    },
    getUserById: async (parent, { id }) => {
      try {
        return await getObjectById({ id });
      } catch (error) {
        console.error(error);
        throw new Error("Could not retreive user");
      }
    },
  },
};

const playground = process.env.ENV !== "prod";

const options = { typeDefs, playground, resolvers };
const handlerOptions = {
  cors: {
    origin: "*",
    methods: ["Access-Control-Allow-Origin"],
  },
};
const server = new ApolloServer(options);

exports.graphql = server.createHandler(handlerOptions);

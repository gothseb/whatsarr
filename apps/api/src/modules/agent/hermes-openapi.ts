// Generated from docs/hermes-agent.openapi.json. Keep both files synchronized.
export const hermesOpenApi = {
  "openapi": "3.0.3",
  "info": {
    "title": "Whatsarr Hermes local API",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "http://localhost:3000"
    }
  ],
  "security": [],
  "paths": {
    "/api/agent/messages": {
      "post": {
        "operationId": "submitHermesMessage",
        "security": [],
        "summary": "Enregistrer un message pour le groupe serveur configure",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/MessageInput"
              },
              "example": {
                "messageId": "hermes-news-2026-10-12-001",
                "text": "Conseil du soir : Dune."
              }
            }
          }
        },
        "responses": {
          "202": {
            "description": "Job cree ; aucun envoi synchrone",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/MessageAccepted"
                }
              }
            }
          },
          "200": {
            "description": "Message identique deja accepte ; meme job",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/MessageAccepted"
                }
              }
            }
          },
          "400": {
            "description": "AGENT_INVALID_REQUEST",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "AGENT_MESSAGE_ID_CONFLICT ou WHATSAPP_GROUP_NOT_SELECTED",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "413": {
            "description": "AGENT_INVALID_REQUEST : corps trop volumineux",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "AGENT_INTERNAL_ERROR",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/api/agent/openapi.json": {
      "get": {
        "operationId": "getHermesOpenApi",
        "security": [],
        "responses": {
          "200": {
            "description": "Ce contrat OpenAPI embarque dans le build",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object"
                }
              }
            }
          }
        }
      }
    },
    "/api/agent/messages/{jobId}": {
      "get": {
        "operationId": "getHermesMessageStatus",
        "security": [],
        "parameters": [
          {
            "name": "jobId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Etat persistant, aucune action d’envoi",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AgentMessageStatus"
                }
              }
            }
          },
          "404": {
            "description": "AGENT_MESSAGE_NOT_FOUND, absent ou non-Hermes",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/api/agent/media/search": {
      "get": {
        "operationId": "searchPlexMedia",
        "security": [],
        "parameters": [
          {
            "name": "q",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string",
              "minLength": 1,
              "maxLength": 200,
              "description": "Titre contenant q, sans distinction de casse, trim avant recherche."
            }
          },
          {
            "name": "libraryKey",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "minLength": 1
            }
          },
          {
            "name": "mediaType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "movie",
                "series"
              ]
            }
          },
          {
            "name": "offset",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 0,
              "default": 0
            }
          },
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100,
              "default": 20
            }
          }
        ],
        "description": "Lecture seule. Filtrage et deduplication avant pagination globale. Toutes bibliotheques video sans filtrage recap. Catalogue vivant ; collecte bornee, erreur si depassee.",
        "responses": {
          "200": {
            "description": "Recherche complete, resultat vide valide",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/SearchResults"
                }
              }
            }
          },
          "400": {
            "description": "AGENT_INVALID_REQUEST",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "PLEX_LIBRARY_NOT_FOUND",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "PLEX_NOT_CONFIGURED",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "502": {
            "description": "PLEX_AUTHENTICATION_ERROR ou PLEX_UNREACHABLE",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "504": {
            "description": "PLEX_TIMEOUT",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/api/agent/media/recent": {
      "get": {
        "operationId": "getRecentPlexMedia",
        "security": [],
        "parameters": [
          {
            "name": "libraryKey",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "minLength": 1
            }
          },
          {
            "name": "mediaType",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "movie",
                "series",
                "episode"
              ]
            }
          },
          {
            "name": "offset",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 0,
              "default": 0
            }
          },
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100,
              "default": 20
            }
          }
        ],
        "description": "Ajouts tries par addedAt decroissant, libraryKey/ratingKey en cas d’egalite. Pas de filtre sur la sortie ni fenetre de six mois. Lecture seule.",
        "responses": {
          "200": {
            "description": "Recherche complete, resultat vide valide",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RecentResults"
                }
              }
            }
          },
          "400": {
            "description": "AGENT_INVALID_REQUEST",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "PLEX_LIBRARY_NOT_FOUND",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "PLEX_NOT_CONFIGURED",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "502": {
            "description": "PLEX_AUTHENTICATION_ERROR ou PLEX_UNREACHABLE",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "504": {
            "description": "PLEX_TIMEOUT",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    },
    "/api/agent/watch-history": {
      "get": {
        "operationId": "getTautulliWatchHistory",
        "security": [],
        "parameters": [
          {
            "name": "userId",
            "in": "query",
            "schema": {
              "type": "string",
              "pattern": "^(0|[1-9][0-9]*)$"
            }
          },
          {
            "name": "from",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date-time",
              "description": "Inclusif sur startedAt, timezone requise, precision max millisecondes."
            }
          },
          {
            "name": "to",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date-time",
              "description": "Exclusif sur startedAt, timezone requise. from=to donne periode vide."
            }
          },
          {
            "name": "offset",
            "in": "query",
            "schema": {
              "type": "integer",
              "minimum": 0,
              "default": 0
            }
          },
          {
            "name": "limit",
            "in": "query",
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100,
              "default": 20
            }
          }
        ],
        "description": "Historique non regroupe ; lectures distinctes conservees. Filtres UTC precis avant pagination ; pas de restriction implicite au recap. Tri startedAt DESC puis row_id DESC interne, nulls en fin.",
        "responses": {
          "200": {
            "description": "Historique normalise en lecture seule",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HistoryResults"
                }
              }
            }
          },
          "400": {
            "description": "AGENT_INVALID_REQUEST",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "TAUTULLI_NOT_CONFIGURED",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "502": {
            "description": "TAUTULLI_AUTHENTICATION_ERROR ou TAUTULLI_UNREACHABLE",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "504": {
            "description": "TAUTULLI_TIMEOUT",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "Error": {
        "type": "object",
        "required": [
          "error"
        ],
        "properties": {
          "error": {
            "type": "object",
            "required": [
              "code",
              "message",
              "requestId"
            ],
            "properties": {
              "code": {
                "type": "string"
              },
              "message": {
                "type": "string"
              },
              "requestId": {
                "type": "string"
              }
            }
          }
        }
      },
      "MessageInput": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "messageId",
          "text"
        ],
        "properties": {
          "messageId": {
            "type": "string",
            "minLength": 1,
            "x-maxUtf16Length": 128,
            "description": "Non blanc, conserve exactement ; longueur JS UTF-16 <=128."
          },
          "text": {
            "type": "string",
            "minLength": 1,
            "x-maxUtf16Length": 4000,
            "description": "Texte exact non blanc ; <=4000 unites UTF-16 seul, <=1000 avec imageUrl.",
            "x-maxUtf16LengthWithImage": 1000
          },
          "imageUrl": {
            "type": "string",
            "format": "uri",
            "description": "HTTP(S) absolue sans username/password ; LAN autorise ; JPEG/PNG 10 Mio max, download 15s. Omission uniquement signifie texte seul."
          }
        }
      },
      "MessageAccepted": {
        "type": "object",
        "required": [
          "jobId",
          "messageId",
          "status",
          "deduplicated",
          "requestId"
        ],
        "properties": {
          "jobId": {
            "type": "string"
          },
          "messageId": {
            "type": "string"
          },
          "requestId": {
            "type": "string"
          },
          "status": {
            "type": "string",
            "enum": [
              "pending",
              "processing",
              "retry_scheduled",
              "sent",
              "failed"
            ]
          },
          "deduplicated": {
            "type": "boolean"
          }
        }
      },
      "AgentMessageStatus": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "jobId",
          "messageId",
          "source",
          "status",
          "attempts",
          "createdAt",
          "sentAt",
          "failedAt",
          "lastError",
          "requestId"
        ],
        "properties": {
          "jobId": {
            "type": "string"
          },
          "messageId": {
            "type": "string"
          },
          "source": {
            "type": "string",
            "enum": [
              "hermes"
            ]
          },
          "status": {
            "type": "string",
            "enum": [
              "pending",
              "processing",
              "retry_scheduled",
              "sent",
              "failed"
            ]
          },
          "attempts": {
            "type": "integer",
            "minimum": 0
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "sentAt": {
            "type": "string",
            "format": "date-time",
            "nullable": true
          },
          "failedAt": {
            "type": "string",
            "format": "date-time",
            "nullable": true
          },
          "lastError": {
            "type": "string",
            "nullable": true
          },
          "requestId": {
            "type": "string",
            "nullable": true,
            "description": "Identifiant de la premiere acceptation, pas du GET courant."
          }
        }
      },
      "Pagination": {
        "type": "object",
        "required": [
          "offset",
          "limit",
          "hasMore"
        ],
        "properties": {
          "offset": {
            "type": "integer",
            "minimum": 0,
            "default": 0
          },
          "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 100,
            "default": 20
          },
          "hasMore": {
            "type": "boolean"
          }
        }
      },
      "MediaItem": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ratingKey",
          "libraryKey",
          "title",
          "mediaType",
          "year",
          "summary",
          "genres",
          "addedAt"
        ],
        "properties": {
          "ratingKey": {
            "type": "string"
          },
          "libraryKey": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "mediaType": {
            "type": "string",
            "enum": [
              "movie",
              "series"
            ]
          },
          "year": {
            "type": "integer",
            "nullable": true
          },
          "summary": {
            "type": "string",
            "nullable": true,
            "description": "Synopsis Plex, null si absent."
          },
          "genres": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "addedAt": {
            "type": "string",
            "format": "date-time",
            "nullable": true
          }
        }
      },
      "SearchResults": {
        "type": "object",
        "required": [
          "items",
          "pagination",
          "source"
        ],
        "properties": {
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/MediaItem"
            }
          },
          "pagination": {
            "$ref": "#/components/schemas/Pagination"
          },
          "source": {
            "type": "string",
            "enum": [
              "plex"
            ]
          }
        }
      },
      "RecentMediaItem": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ratingKey",
          "libraryKey",
          "title",
          "mediaType",
          "year",
          "summary",
          "genres",
          "addedAt",
          "releaseDate",
          "seriesTitle",
          "seasonNumber",
          "episodeNumber"
        ],
        "properties": {
          "ratingKey": {
            "type": "string"
          },
          "libraryKey": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "mediaType": {
            "type": "string",
            "enum": [
              "movie",
              "series",
              "episode"
            ]
          },
          "year": {
            "type": "integer",
            "nullable": true
          },
          "summary": {
            "type": "string",
            "nullable": true
          },
          "genres": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "addedAt": {
            "type": "string",
            "format": "date-time",
            "nullable": true
          },
          "releaseDate": {
            "type": "string",
            "format": "date",
            "nullable": true
          },
          "seriesTitle": {
            "type": "string",
            "nullable": true
          },
          "seasonNumber": {
            "type": "integer",
            "minimum": 0,
            "nullable": true
          },
          "episodeNumber": {
            "type": "integer",
            "minimum": 0,
            "nullable": true
          }
        }
      },
      "RecentResults": {
        "type": "object",
        "required": [
          "items",
          "pagination",
          "source"
        ],
        "properties": {
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/RecentMediaItem"
            }
          },
          "pagination": {
            "$ref": "#/components/schemas/Pagination"
          },
          "source": {
            "type": "string",
            "enum": [
              "plex"
            ]
          }
        }
      },
      "HistoryItem": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "userId",
          "userName",
          "title",
          "mediaType",
          "ratingKey",
          "libraryKey",
          "startedAt",
          "stoppedAt",
          "durationSeconds",
          "progressPercent",
          "seriesTitle",
          "seasonNumber",
          "episodeNumber"
        ],
        "properties": {
          "userId": {
            "type": "string",
            "nullable": true
          },
          "userName": {
            "type": "string",
            "nullable": true
          },
          "title": {
            "type": "string",
            "nullable": true
          },
          "ratingKey": {
            "type": "string",
            "nullable": true
          },
          "libraryKey": {
            "type": "string",
            "nullable": true
          },
          "seriesTitle": {
            "type": "string",
            "nullable": true
          },
          "mediaType": {
            "type": "string",
            "enum": [
              "movie",
              "episode",
              "track",
              "live",
              "collection",
              "playlist",
              null
            ],
            "nullable": true
          },
          "startedAt": {
            "type": "string",
            "format": "date-time",
            "nullable": true
          },
          "stoppedAt": {
            "type": "string",
            "format": "date-time",
            "nullable": true
          },
          "durationSeconds": {
            "type": "integer",
            "minimum": 0,
            "nullable": true
          },
          "seasonNumber": {
            "type": "integer",
            "minimum": 0,
            "nullable": true
          },
          "episodeNumber": {
            "type": "integer",
            "minimum": 0,
            "nullable": true
          },
          "progressPercent": {
            "type": "number",
            "minimum": 0,
            "maximum": 100,
            "nullable": true
          }
        }
      },
      "HistoryResults": {
        "type": "object",
        "required": [
          "items",
          "pagination",
          "source"
        ],
        "properties": {
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/HistoryItem"
            }
          },
          "pagination": {
            "$ref": "#/components/schemas/Pagination"
          },
          "source": {
            "type": "string",
            "enum": [
              "tautulli"
            ]
          }
        }
      }
    }
  }
} as const;

#!/bin/sh
# This script should be called as ". ./config.sh" or "source ./config.sh"
export NODE_ENV='test'

export DS_ARANGODB_HOST='localhost'
export DS_ARANGODB_PORT='8529'
export DS_ARANGODB_USER='root'
export DS_ARANGODB_PASSWORD='YourPasswordHere'
export DS_ARANGODB_DATABASE='test'

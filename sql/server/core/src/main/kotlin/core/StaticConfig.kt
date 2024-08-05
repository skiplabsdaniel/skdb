package io.skiplabs.skdb

import java.io.FileInputStream
import java.nio.file.Files
import java.nio.file.Paths
import java.util.Optional
import java.util.Properties

val USER_CONFIG_FILE = ".skdb.conf"
val SKDB_PORT = 3586
var ENV = UserConfig.create()

class UserConfig(
    val port: Int,
    val skdbPath: String,
    val skdbInitPath: String,
    val skdbDatabases: String,
    val skstore: Boolean,
) {
  companion object {
    val SKDB = "/skdb/build/skdb"
    val SKDB_INIT = "/skdb/build/init.sql"
    val SKDB_DATABASES = "/var/db"
    val SKSTORE = false

    private fun userConfigFile(): Optional<String> {
      var path = Paths.get("").toAbsolutePath()
      while (path != null) {
        var file = path.resolve(USER_CONFIG_FILE)
        if (Files.exists(file)) {
          return Optional.of(file.toString())
        }
        path = path.getParent()
      }
      return Optional.empty()
    }

    fun fromFile(file: String): UserConfig {
      FileInputStream(file).use {
        var prop = Properties()
        // load a properties file
        prop.load(it)
        return UserConfig(
            Integer.parseInt(prop.getProperty("skdb_port", "" + SKDB_PORT)),
            prop.getProperty("skdb", SKDB),
            prop.getProperty("skdb_init", SKDB_INIT),
            prop.getProperty("skdb_databases", SKDB_DATABASES),
            prop.getProperty("skstore", "" + SKSTORE) == "true",
        )
      }
    }

    fun create(port: Int = SKDB_PORT): UserConfig {
      var user_config_file = userConfigFile()
      if (user_config_file.isPresent()) {
        return fromFile(user_config_file.get())
      }
      return UserConfig(port, SKDB, SKDB_INIT, SKDB_DATABASES, SKSTORE)
    }
  }

  fun resolveDbPath(db: String): String {
    return Paths.get(this.skdbDatabases).resolve(db + ".db").toString()
  }
}

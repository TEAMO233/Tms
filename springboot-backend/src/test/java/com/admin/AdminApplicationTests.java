package com.admin;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

import javax.annotation.Resource;

import static org.junit.jupiter.api.Assertions.assertFalse;

@SpringBootTest(properties = {
        "jwt-secret=test-secret",
        "log-dir=/tmp/tms-test-logs",
        "schema-migration.enabled=false"
})
class AdminApplicationTests {

    @Resource
    private ApplicationContext applicationContext;

    @Test
    void contextLoadsWithoutRunningSchemaMigration() {
        assertFalse(applicationContext.containsBean("schemaMigration"));
    }
}

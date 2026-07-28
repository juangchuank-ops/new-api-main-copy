package model

import "testing"

func TestShouldSkipDatabaseMigration(t *testing.T) {
	testCases := []struct {
		name  string
		value string
		want  bool
	}{
		{name: "unset", value: "", want: false},
		{name: "false", value: "false", want: false},
		{name: "one", value: "1", want: false},
		{name: "true", value: "true", want: true},
		{name: "uppercase true", value: "TRUE", want: true},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Setenv("SKIP_DATABASE_MIGRATION", testCase.value)
			if got := shouldSkipDatabaseMigration(); got != testCase.want {
				t.Fatalf("shouldSkipDatabaseMigration() = %v, want %v", got, testCase.want)
			}
		})
	}
}

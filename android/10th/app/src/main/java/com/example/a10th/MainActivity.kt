package com.example.a10th

import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat


class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        val editName = findViewById<EditText>(R.id.editName) //이름 객체변수
        val editPassword = findViewById<EditText>(R.id.editPassword) //비밀번호 객체번수
        val editEmail = findViewById<EditText>(R.id.editEmail) // 이메일 객체변수
        val editBirth = findViewById<EditText>(R.id.editBirth) // 생년월일 객체 변수
        val editPhone = findViewById<EditText>(R.id.editPhone) // 전화번호 객체변수
        val btnResult = findViewById<Button>(R.id.btnResult) // 결과보기 버튼 객체변수
        val textResult = findViewById<TextView>(R.id.textResult)

        btnResult.setOnClickListener {
            val name = editName.text.toString()
            val password = editPassword.text.toString()
            val email = editEmail.text.toString()
            val birth = editBirth.text.toString()
            val phone = editPhone.text.toString()

            textResult.text = """
                이름: $name
                비밀번호: $password
                이메일: $email
                생년월일: $birth
                연락처: $phone
            """.trimIndent()
        }
    }
}
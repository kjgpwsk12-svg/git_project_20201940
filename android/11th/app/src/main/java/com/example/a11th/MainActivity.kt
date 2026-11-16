package com.example.a11th

import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.ImageView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : AppCompatActivity() {

    lateinit var button: Button
    lateinit var dog1: ImageView
    lateinit var dog2: ImageView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        button = findViewById(R.id.button_id)
        dog1 = findViewById(R.id.dog1)
        dog2 = findViewById(R.id.dog2)
    }

    fun onButtonClick(v: View){
        button.text = "버튼 클릭 이벤트"
        dog1.visibility = View.VISIBLE
        dog2.visibility = View.VISIBLE
    }
}